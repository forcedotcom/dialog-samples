/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * A Dialog component implementation that can replace the native browser dialogs:
 * alert, confirm, prompt
 * 
 * NOTE: The native browser dialogs are synchronous by design. This implementation is asynchronous.
 *       When using this implementation additional consideration is needed to handle the asynchronous nature.
 * 
 * API:
 *  Dialog.alert(msg, opts, cb);
 *  Dialog.confirm(msg, opts, cb);
 *  Dialog.prompt(msg, opts, cb);
 * 
 * where
 *   msg {String} A message to display in the dialog
 *   opts {Object} Must contain "ok" and "cancel" properties for localized button labels
 *   cb {Function} The callback function to be invoked when user closes the dialog. The return value is same as native browser apis.
 *
 * Events:
 *   You can attach event listeners for these events emitted by this component:
 *   "ready" - dialog is created and attached to DOM
 *   "open" - dialog has been opened
 *   "close" - dialog has been closed
 *  
 * @example:
 *   <apex:commandButton id="save" action="{!save}" value="Save"
 *     onclick="event.preventDefault(); Dialog.confirm(
 *       'Are you sure?', 
 *       {ok: 'Ok', cancel: 'Cancel'},
 *       (ret) => { if(ret) this.form.submit()) }
 *     )" />
 */

let Dialog = (() => {

	const TO_FOCUS_ON = [
		'a[href]:not([tabindex^="-"])',
		'area[href]:not([tabindex^="-"])',
		'input:not([type="hidden"]):not([type="radio"]):not([disabled]):not([tabindex^="-"])',
		'input[type="radio"]:not([disabled]):not([tabindex^="-"])',
		'select:not([disabled]):not([tabindex^="-"])',
		'textarea:not([disabled]):not([tabindex^="-"])',
		'button:not([disabled]):not([tabindex^="-"])',
		'iframe:not([tabindex^="-"])',
		'audio[controls]:not([tabindex^="-"])',
		'video[controls]:not([tabindex^="-"])',
		'[contenteditable]:not([tabindex^="-"])',
		'[tabindex]:not([tabindex^="-"])'
	].join(',');

	const CLOSER_ATTR = 'data-sfdc-dialog-closer';
	const ID_PREFIX = 'sfdcDialog';  // prefix of the dialog ID attribute
	let num = 0; // counter value, appended to ID_PREFIX to make multiple nested dialog DOM elements unique

	// CSS class names
	const CSS = {
		Buttons: 'sfdc-dialog-buttons',
		DialogContainer: 'sfdc-dialog-container',
		DialogContent: 'sfdc-dialog-content',
		PrimaryButton: 'sfdc-dialog-button-primary',
		Overlay: 'sfdc-dialog-overlay'
	}

	// Event names
	const EVENTS = {
		Close: 'close',
		Open: 'open',
		Ready: 'ready'
	}

	/** A basic dialog component that can replace native alert/confirm/prompt browser functions */
	class ACPDialog {

		/**
		 * Constructor
		 *
		 * @constructor
		 * @param {String} message the message to display in the UI
		 * @param {Object} opts addtional "options" for the dialog, e.g. labels of buttons "ok" and "cancel"
		 * @param {Function} cb the callback function to invoke when the user "closes" the dialog
		 * @param {Object} defaultValue For prompt dialogs, the defaultValue to return if the user enters nothing
		 */
		constructor(message, opts, cb, defaultValue) {
			// Memoize bound functions to not lose the "this" value in event listeners
			this._close = this.close.bind(this);
			this._focusListener = this._focusListener.bind(this);
			this._keydownListener = this._keydownListener.bind(this);

			this._isOpen = false;
			this._previousFocusElement = null;
			this._listeners = {};
			this._cb = cb;
			this._opts = opts;

			this.$el = this._initDOM(message, defaultValue);
			this._id = this.$el.id;

			// Attach event listeners to newly created DOM element
			return this._attachListeners();
		}

		/** Create the dynamic DOM element(s) for the dialog and append to DOM */
		_initDOM(message, defaultValue) {
			const id = `${ID_PREFIX}${num++}`;
			const inputElement = this._getInputElement(defaultValue);
			const cancelButton = this._getCancelButton();
			const okButton = this._getOkButton();

			let el = document.createElement('div');
			ACPDialog.setAttributes(el, {
				id: id,
				'class': CSS.DialogContainer,
				role: 'alertdialog',
				'aria-labelledby': message,
				'aria-hidden': 'true',
				'aria-modal': 'true',
				tabindex: '-1'
			});

			el.innerHTML = `
		<div class="${CSS.Overlay}"></div>
		<div role="document" class="${CSS.DialogContent}">
			<p>${message}</p>
			${inputElement}
			<div class="${CSS.Buttons}">
				${cancelButton}
				${okButton}
			</div>
		</div>`;

			document.body.appendChild(el);
			return el;
		}

		/**
		 * Attach listeners to the dialog DOM elements
		 * 
		 * @return {this}
		 */
		_attachListeners() {
			// Att of dialog closers, each of which will be bound a click event listener to close the dialog
			this._closers = ACPDialog.$$(`[${CLOSER_ATTR}]`, this.$el);
			this._closers.forEach( (closer) => {
				closer.addEventListener('click', this._close);
			});

			return this._fire(EVENTS.Ready);
		}

		/**
		 * Open the dialog, i.e. make it visible. While open the focus will
		 * stay within the dialog even during keyboard events/navigation.
		 *
		 * @param {Event} event the browser event that initiated this "open" call
		 * @return {this}
		 */
		open(event) {
			if (this._isOpen) {  // do nothing if already open
				return this;
			}

			this._previousFocusElement = document.activeElement; // Remember previously focused element
			this.$el.removeAttribute('aria-hidden');

			// Put focus inside the dialog
			this._focusOnDialog();

			// Attach focus & keyboard listeners (ESC & TAB)
			document.body.addEventListener('focus', this._focusListener, true);
			document.addEventListener('keydown', this._keydownListener);

			this._isOpen = true;
			return this._fire(EVENTS.Open, event);
		}

		/**
		 * Close the dialog, i.e. remove it from the DOM. Cleanup all the listeners.
		 *
		 * @param {Event} event the browser event that initiated this "close" call
		 * @return {this}
		 */
		close(event) {
			if (!this._isOpen) {  // do nothing if already closed
				return this;
			}

			this.$el.setAttribute('aria-hidden', 'true');

			// Restore focus
			if (this._previousFocusElement && this._previousFocusElement.focus) {
				this._previousFocusElement.focus();
			}

			// Cleanup event listeners
			document.body.removeEventListener('focus', this._focusListener, true);
			document.removeEventListener('keydown', this._keydownListener);

			this._closers.forEach((closer) => {
				closer.removeEventListener('click', this._close);
			});

			// Release listeners from memory
			this._listeners = {};
			this._isOpen = false;

			// Cleanup DOM
			document.body.removeChild(this.$el);

			// Execute callback function
			if(this._cb && typeof this._cb === 'function') {
				this._executeCallback(event);
			}

			return this._fire(EVENTS.Close, event);
		}

		/**
		 * Register a listener for an event emitted by this class
		 *
		 * @param {String} the event type
		 * @param {Function} listener the listener to invoke when this event fires
		 */
		on(type, listener) {
			if( type && typeof type === 'string' && typeof listener === 'function') {
				if (typeof this._listeners[type] === 'undefined') {
					this._listeners[type] = [];
				}

				this._listeners[type].push(listener);
			}
			return this;
		}

		/**
		 * Unregister a listener
		 *
		 * @param {String} type the event type
		 * @param {Function} listener the listener to unregister
		 */
		off(type, listener) {
			let index = (this._listeners[type] || []).indexOf(listener);

			if (index >= 0) {
				this._listeners[type].splice(index, 1);
			}

			return this;
		}

		/**
		 * Invoke any registered listeners for given event type.
		 *
		 * @param {String} type the event type
		 * @param {Event} event the DOM event that triggered this class event
		 */
		_fire(type, event) {
			let listeners = this._listeners[type];
			if( listeners && listeners.forEach) {
				listeners.forEach((listener) => {
					listener(this.$el, event);
				});
			}

			return this;
		}

		/**
		 * Listener for specific key presses (ESC and TAB, to close and keep focus).
		 *
		 * @param {Event} event the DOM keyboard event
		 */
		_keydownListener(event) {
			// Ensure we only are listening to events for this dialog, in case of nested/multiple dialogs (BAD UX practice!)
			if (!this.$el.contains(document.activeElement)) return;

			if (this._isOpen) {
				switch(event.which) {
					case 9: // TAB
						this._tabKeydownListener(event); // Keep focus trapped within this dialog
						break;
					case 27: // ESC
						event.preventDefault();
						this._close(event, true); // Close this dialog
						break;
				}
			}
		}

		/** Set focus on first element with `autofocus` or dialog */
		_focusOnDialog() {
			let focused = this.$el.querySelector('[autofocus]') || this.$el;
			if(focused && focused.focus) focused.focus();
		}

		/**
		 * Listener for focus events to keep focus within dialog
		 *
		 * @param {Event} event the DOM event that triggered this listener
		 */
		_focusListener(event) {
			// If focus is not within this dialog element move it back to its first focusable child
			if (this._isOpen && !event.target.closest('[aria-modal="true"]')) {
				this._focusOnDialog();
			}
		}

		/**
		 * Listener to TAB keydown events. Keeps focus within this dialog.
		 * @param {Event} event the DOM event that triggered this listener
		 */
		_tabKeydownListener(event) {
			let focusableChildren = ACPDialog.$$(TO_FOCUS_ON, this.$el).filter((child) => {
				return !!( child.offsetWidth || child.offsetHeight || child.getClientRects().length);
			});

			let focusedItemIndex = focusableChildren.indexOf(document.activeElement);

			// If SHIFT+TAB and at "top" of dialog move focus to the last focusable item inside the dialog
			if (event.shiftKey && focusedItemIndex === 0) {
				focusableChildren[focusableChildren.length - 1].focus();
				event.preventDefault();
				// If not SHIFT and at "bottom" of dialog move focus to first focusable item inside dialog
			} else if (!event.shiftKey && focusedItemIndex === focusableChildren.length - 1) {
				focusableChildren[0].focus();
				event.preventDefault();
			}
		}
	}

	/**
	 * Helper function to set DOM attributes on a element using a simple map object
	 * 
	 * @param {Object} element the element to set the attributes on
	 * @param {Object} map the Map of attribute names to values
	 */
	ACPDialog.setAttributes = function(element,map) {
		if(element && element.setAttribute && map) {
			for(const [key, value] of Object.entries(map))
				element.setAttribute(key,value);
		}
	}

	/**
	 * Better/helper version of document.querySelectorAll()
	 *
	 * @param {String} selector the CSS selector
	 * @param {Element} [context = document] the context element, used to scope the query
	 * @return {Array<Element>} all descendat elements matching the query
	 */
	ACPDialog.$$ = function(selector, context) {
		return Array.prototype.slice.call(((context || document).querySelectorAll(selector)));
	}

	/** An Alert dialog to replace native browser alert() function */
	class AlertDialog extends ACPDialog {
		_getInputElement() {
			return '';
		}

		_getCancelButton() {
			return '';
		}

		_getOkButton() {
			return `<button type="button" autofocus ${CLOSER_ATTR} class="${CSS.PrimaryButton}">${this._opts.ok}</button>`;
		}

		_executeCallback(e) {
			this._cb();
		}
	}

	/** Abstract class with common code for both Confirm and Prompt dialogs */
	class CPDialog extends ACPDialog {
		_getOkButton() {
			return `<button type="button" ${CLOSER_ATTR} class="${CSS.PrimaryButton}">${this._opts.ok}</button>`;
		}

		_isOkButtonEvent(e) {
			return e && e.target && e.target.classList ? e.target.classList.contains(CSS.PrimaryButton) : false;
		}
	}

	/** A Confirm dialog to replace native browser confirm() function */
	class ConfirmDialog extends CPDialog {
		_getInputElement() {
			return '';
		}

		_getCancelButton() {
			return `<button type="button" autofocus ${CLOSER_ATTR}>${this._opts.cancel}</button>`;
		}

		_executeCallback(e) {
			this._cb(this._isOkButtonEvent(e) ? true : false);
		}
	}

	/** A Prompt dialog to replace native browser prompt() function */
	class PromptDialog extends CPDialog {
		_getInputElement(defaultValue) {
			return `<input type="text" autofocus value="${defaultValue ? defaultValue : ''}"></input>`;
		}

		_getCancelButton() {
			return `<button type="button" ${CLOSER_ATTR}>${this._opts.cancel}</button>`;
		}

		_executeCallback(e) {
			this._cb(this._isOkButtonEvent(e) ? this.$el.querySelector('input').value : null);
		}
	}

	// expose the external API to the caller/user of this code
	return {
		/*
		* Shows a modal dialog to display a message.
		* @param {String} message The message to be displayed in the modal dialog
		* @param {Object} opts options including localized button labels
		* @param {Function} cb the callback function to invoke when dialog is closed
		*/
		alert(message, opts, cb) {
			return new AlertDialog(message, opts, cb).open();
		},

		/*
		* Shows a modal dialog to prompt user to confirm an action.
		* @param {String} message The message to be displayed in the modal dialog
		* @param {Object} opts options including localized button labels
		* @param {Function} cb the callback function to invoke when dialog is closed
		*/
		confirm(message, opts, cb) {
			return new ConfirmDialog(message, opts, cb).open();
		},

		/*
		* Shows a modal dialog to prompt user to confirm an action.
		* @param {String} message The message to be displayed in the modal dialog
		* @param {Object} opts options including localized button labels
		* @param {Function} cb the callback function to invoke when dialog is closed
		* @param {String} [defaultValue] the initial value of the input text box
		*/
		prompt(message, opts, cb, defaultValue) {
			return new PromptDialog(message, opts, cb, defaultValue).open();
		}
	}

})();