/**
 * App
 *
 * Shared state (rate, settings), hash router and toasts.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import type {AppState, Rate} from "./Types";
import RateService from "./services/RateService";
import {keepKnownNotes} from "./utils/Notes";
import type Backend from "./backend/Backend";
import {Toast} from "@materializecss/materialize";

/**
 * Page
 */
export interface Page {
    el:HTMLElement;
    destroy?():void;
}

type PageFactory = (app:App, param:string|null) => Page;

/**
 * App
 */
export default class App {

    /** Public Parameters
     ******************************************************
     */

    /** @var state Cached rate and settings */
    public state!:AppState;

    /** @var rates Online rate refresher */
    public rates!:RateService;

    /** Private Parameters
     ******************************************************
     */

    /** @var _page Page currently displayed */
    private _page:Page|null = null;

    /** @var _rateListeners Called when the default rate changes */
    private _rateListeners = new Set<(rate:Rate) => void>();

    /**
     * Constructor
     *
     * @param backend Native or web backend
     * @param _root Element hosting the pages
     * @param _routes Page factory per first path segment ("" for home)
     */
    constructor(
        public backend:Backend,
        private _root:HTMLElement,
        private _routes:Record<string, PageFactory>,
    ) {}

    /** Public Methods
     ******************************************************
     */

    /**
     * Start
     */
    public start = async():Promise<void> => {

        // Load cached state, without notes no longer in use (1,000 LL)
        this.state = await this.backend.getState();
        this.state.settings.denominations = keepKnownNotes(this.state.settings.denominations);

        // Router
        window.addEventListener("hashchange", this._route);
        this._route();

        // Rate refresh when online
        this.rates = new RateService(this.backend, rate => {

            this.state.rate = rate;
            this._rateListeners.forEach(listener => listener(rate));

        });
        this.rates.watch();

    }

    /**
     * On Rate Change
     *
     * @param listener Called with the new default rate
     * @return Unsubscribe function
     */
    public onRateChange = (listener:(rate:Rate) => void):(() => void) => {

        this._rateListeners.add(listener);

        return () => this._rateListeners.delete(listener);

    }

    /**
     * Navigate
     *
     * @param path Path such as "/", "/tx/new", "/settings"
     */
    public navigate = (path:string):void => {

        window.location.hash = `#${path}`;

    }

    /**
     * Toast
     *
     * @param text Message
     */
    public toast = (text:string):void => {

        new Toast({text, displayLength: 2500});

    }

    /** Private Methods
     ******************************************************
     */

    /**
     * Route
     */
    private _route = ():void => {

        // Parse "#/segment/param"
        const [segment = "", param = null] = window.location.hash.replace(/^#\/?/, "").split("/");
        const factory = this._routes[segment] ?? this._routes[""];

        // Swap page
        this._page?.destroy?.();
        this._page = factory(this, param);
        this._root.replaceChildren(this._page.el);
        window.scrollTo(0, 0);

    }

}
