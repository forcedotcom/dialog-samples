/*
 * Provides showAlert() and showConfirm() to replace native alert() and confirm() respectively.
 *
 * NOTE: the showAlert() and showConfirm() display asynchronous dialogs which do not block other
 *       code execution.  When using these showAlert() and showConfirm(), additional consideration
 *       is needed to prevent form submission.
 * 
 * @example:
 *    The following example shows how to use Dialog.showConfirm() to replace the window.confirm() in 
 *    <apex:form>
 * 
 *    <!-- Use window.confirm() to prompt the user before form submission:
 *    <apex:form id="theForm">
 *       <apex:commandButton id="save" action="{!save}" value="Save"
 *             onclick="if (!confirm('are you sure?')) { return false; }" />
 *    </apex:form>
 * 
 *    <!-- Replaces the window.confirm() with Dialog.showConfirm() -->
 *    <apex:form id="theForm">
 *       <apex:commandButton id="save" action="{!save}" value="Save"
 *             onclick="event.preventDefault(); Dialog.showConfirm('Are you sure?', () => { this.form.submit()) })" />
 *    </apex:form>
 * 
 */
var Dialog = {
    dialogs: {},
    num: 0,
    getNextId: function() {
        return "simpleDialog" + Dialog.num++;
    },

    types: {
        INFO: {
            backgroundClass: "backgroundInfo",
            contentClass: "contentInfo",
            iconClass: "infoLarge",
            getIconAlt: "Information"
        },

        CONFIRM: {
            backgroundClass: "backgroundConfirm",
            contentClass: "contentConfirm",
            iconClass: "confirmLarge",
            getIconAlt: "Confirmation"
        }
    },

    /*
     * Shows a modal dialog to display a message.
     * @param message - message to be displayed in the modal dialog.
     */
    showAlert: function(message) {
        Dialog.createSimpleDialog(message, Dialog.types.INFO).show();
    },

    /*
     * Shows a modal dialog to prompt user to confirm an action.
     * @param message - question to the user.
     * @param onOK - function to execute after user confirms the action.
     */
    showConfirm: function(message, onOK) {
        Dialog.createSimpleDialog(message, Dialog.types.CONFIRM, onOK).show();
    },

    createSimpleDialog: function(message, type, onOK) {
        var actions = [];
        var actionLabels;
 
        if (onOK) {             
            actions = [onOK, null];
            actionLabels = ["ok", "cancel"];
        } else {
            actionLabels= ["ok"];            
        }

        var config = {
            id: Dialog.getNextId(),
            message: message,
            actions: actions,
            actionLabels: actionLabels,
            ...type       
        }
        
        var dialog = new OverlayDialog(config);
        this.registerDialog(dialog);
        return dialog;
    },

    registerDialog: function(dialog) {
        Dialog.dialogs[dialog.id] = dialog;
    },

    getDialogById: function(id) {
        return Dialog.dialogs[id];
    }
};

/*
 * A modal dialog using CSS
 */
OverlayDialog.MAX_WIDTH = 400;
OverlayDialog.HIDDEN_STYLE = "width:2px;height:2px;position:absolute;border:0;margin:0;padding:0;background:none;outline:none;z-index:-1;cursor:none;";

function OverlayDialog(config) {
    this.id = config.id;
    this.dialog = null; // to hold the div element once it has been created
    this.background = null; // create the background lazily
    this.width = OverlayDialog.MAX_WIDTH;
    this.isOpen = false;
    this.created = false;
    this.isAbsolutePositioned = false;
    this.focusPointId = null;
    this.wrappingPointId = null;
    this.message = config.message;
    this.backgroundClass = config.backgroundClass;
    this.contentClass = config.contentClass;
    this.iconClass = config.iconClass;
    this.iconAlt = config.geticonAlt;
    this.actions = config.actions;
    this.actionLabels = config.actionLabels;  

    // track original window overflow - scrolling disabled when modal dialog is open
    this.htmlOverflow = '';    
}

/*
 * Sets the desired width, default to MAX_WIDTH.
 * @param width - the desired width in pixels.
 */
OverlayDialog.prototype.setWidth = function(width) {
    this.width = width;
    if (this.dialog) {
        if (width !== undefined && width !== null) {
            if (typeof width == 'string') {
                this.dialog.style.width = width;
            } else {
                this.dialog.style.width = width + 'px';
            }
        }
        if (this.isOpen) {
            this.position();
        }
    }
};

/*
 * Displays the dialog after creation.
 */
OverlayDialog.prototype.show = function() {   
    var oe = this.getPageOverflowElement();
    this.htmlOverflow = oe.style.overflow;
    oe.style.overflow = 'hidden';
    
    if (!this.dialog) {
        this.createDialog();
    }
    this.dialog.style.display = 'block';
    this.position();

    if (!this.background) {
        this.createBackground();
    }
    this.background.style.display = 'block';    
    this.dialog.style.visibility = 'visible';
    this.isOpen = true;
    // We delay this by 1ms so that the overlay has a chance to position itself
    // otherwise it will sometimes display at its previous position.
    delay(this.setPrimaryFocus, 1, this, []);
};

function delay(func, delay, context, args) {
    args = args || [];
    context = context || window;     
    return {
    		timeoutId : setTimeout(function() {
            				func.apply(context, args);
    			        }, delay),
            cancel: function() { clearTimeout(this.timeoutId); }
    };
}

/**
 * Moves focus to the appropriate element within the dialog, unless that element is disabled.
 *
 * @param wrapping - true if wrapping focus to avoid tabbing off the dialog rather than focusing on show.
 */
OverlayDialog.prototype.setPrimaryFocus = function(wrapping) {       
    if (wrapping === true) {
        if (this.wrappingPointId !== null) {
            setFocusIfNotDisabled(this.wrappingPointId);
        }
    } else {
        if (this.focusPointId !== null) {
            setFocusIfNotDisabled(this.focusPointId);
        }   
    }
};

function setFocusIfNotDisabled(elementId) {
    var focusElement = document.getElementById(elementId);
    console.log('focusElement: ' + focusElement);
    if (focusElement !== null && focusElement.disabled !== true) {
        try {
            focusElement.focus();
        } catch (ignore) {            
        }
    } else {
        throw new Error(elementId + ' could not be focused');
    }
};

/*
 * Hides the dialog after the OK button or X is clicked.
 */
OverlayDialog.prototype.hide = function() {
    this.background.style.display = 'none';    
    this.dialog.style.visibility = 'hidden';
    this.dialog.style.display = 'none';
    this.getPageOverflowElement().style.overflow = this.htmlOverflow;    
    this.htmlOverflow = "";
    this.isOpen = false;
};

OverlayDialog.prototype.getPageOverflowElement = function() {
    return document.documentElement;    
};

/**
 * called when clicking on the X to get out of the dialog
 */
OverlayDialog.prototype.cancel = function() {
    this.hide();
};

OverlayDialog.prototype.position = function() {
    if (!this.dialog) {
        return;
    }
    var dialogStyle = this.dialog.style;
    dialogStyle.marginTop = ((-0.25)*this.dialog.offsetHeight) + 'px';
    dialogStyle.marginLeft = ((-0.5)*this.dialog.offsetWidth) + 'px';    
};

OverlayDialog.prototype.createBackground = function() {
    this.background = document.createElement('div');
    this.background.className = "overlayBackground";
    this.background.style.width = "10000px";
    this.background.style.height = "20000px";        
    document.body.appendChild(this.background);
};

OverlayDialog.prototype.createDialog = function() {
    this.dialog = this.createDialogElement();
    document.body.appendChild(this.dialog);
    this.setWidth(this.width);

    var self = this;
    // if user tries to tab off the bottom of dialog, wrap around to start    
    addEvent(document.getElementById(this.blurCatchId), 'focus', function() {
        self.setPrimaryFocus(true);
    });

    // if user gets behind mask somehow, put them back in the dialog
    addEvent(document.body, 'keyup', function() {
        if (self && self.isOpen) {
            var e = document.activeElement;
            var isInDialog = true;
            while (true) {
                if (e.id == self.id) {
                    break;
                }
                else if (e === document.body) {
                    isInDialog = false;
                    break;
                }
                e = e.parentNode;
            }
            if (!isInDialog) {
                self.setPrimaryFocus();
            }
        }
    });
    this.createContent();
    this.created = true;
};

OverlayDialog.prototype.createContent = function() {
    var content = document.getElementById(this.getContentId());    
    content.innerHTML = this.getContent();
    return content;
};

OverlayDialog.prototype.getContent = function() {
    var html = [];
    html.push("<table border='0'><tr><td style='vertical-align: top'><img src='/img/s.gif' class='");
    html.push(this.iconClass);
    html.push("' alt='");
    html.push(this.iconAlt);
    html.push("'></td><td style='padding-left: 8px; vertical-align: top; line-height: 16px'>")
    html.push(this.message);
    html.push("</td></tr></table>");
    html.push("<div class='buttons'>");
    for (var i = 0; i < this.actionLabels.length; i++) {
        html.push("<input type='button' id='");
        html.push(this.id);
        html.push("button");
        html.push(i);
        html.push("' onclick='");
        html.push("Dialog.getDialogById(\"");
        html.push(this.id);
        html.push("\").doAction(");
        html.push(i);
        html.push(")' class='");
        html.push("btn"); 
        html.push("' value='");
        html.push(this.actionLabels[i]);
        html.push("'");
        html.push("/>");
    }
    html.push("</div>");
    return html.join("");
};

OverlayDialog.prototype.createDialogElement = function() {
    this.blurCatchId = this.id+"BlurCatch";
    this.focusPointId = this.id+"FocusPoint";

    // Wrap back around to the 'x' when the user tabs past the last focusable thing in the overlay.
    this.wrappingPointId = this.id+"X";
    var titleId = this.id+"Title";
    var div = document.createElement("div");
    div.id = this.id;
    div.setAttribute("role", "dialog");
    div.setAttribute("aria-live", "assertive");
    div.setAttribute("aria-describedby", titleId);

    var classes = ["overlayDialog", 'cssDialog'];
    if (this.isAbsolutePositioned) {
        classes.push("absolutePositionedOverlayDialog");
    }
    classes.push(this.extraClass);
    div.className = classes.join(" ");

    var html = [];
    html.push("<div class='topRight");

    html.push("'");
    html.push(">");
    html.push("<a id='" + this.focusPointId + "' ");
    html.push("href='javascript:void(0)' ");
    html.push("onclick='return false;' ");
    html.push("style='" + OverlayDialog.HIDDEN_STYLE + "' ");
    html.push("title='startOfDialog' ");
    html.push("onfocus='document.getElementById(\""+this.wrappingPointId+"\").focus()'");    
    html.push(">");
    html.push("startOfDialog");
    html.push("</a>");
    html.push("<div class='topLeft'>");
    
    // Handle closing X
    html.push("<a id='"+this.wrappingPointId+"' title='close' tabindex='0' onmouseover=\"this.className = 'dialogCloseOn'\" onmouseout=\"this.className = 'dialogClose'\" onclick=\"var dlg = Dialog.getDialogById('");
    html.push(this.id);
    html.push("');");      
    html.push("dlg.cancel()\" href='javascript:void(0)' class='dialogClose'>" + "close" + "</a>");
    
    html.push("<h2 id='"  + titleId + "'>");
    html.push("</h2></div></div><div class='middle'><div class='innerContent' id='");
    html.push(this.getContentId());
    html.push("'></div></div>");

    html.push("<div class='bottomRight'");
    html.push("><label style=\"display:none;\" for ="+"\""+this.blurCatchId+"\""+">'&nbsp;'</label><input id='" + this.blurCatchId + "' style='" + OverlayDialog.HIDDEN_STYLE + "' type='text' /><div class='bottomLeft'></div></div>");
    div.innerHTML = html.join("");
    return div;
};

OverlayDialog.prototype.getContentId = function() {
    return this.id + "Content";
};

OverlayDialog.prototype.doAction = function(index) {
    this.hide();
    if (this.actions[index] && typeof this.actions[index] == "function") {
        this.actions[index]();
    }
};

function EventData(e, type, fn, useCap) {
    this.element = e;
    this.type = type;
    this.handler = fn;
    this.useCapture = useCap;
}

var eventRegistry;
var addEvent = function () {
    if (window.addEventListener) {
        return function (obj, evType, fn, useCapture) {
            obj.addEventListener(evType, fn, useCapture);
            if (!eventRegistry) {
                eventRegistry = [];
                window.addEventListener('unload', cleanupEvents, false);
            }
            eventRegistry.push(new EventData(obj, evType, fn, useCapture));
        };
    } else if (window.attachEvent) {
        return function (obj, evType, fn, useCapture) {
            var r = obj.attachEvent("on" + evType, fn);
            if (!eventRegistry) {
                eventRegistry = [];
                window.attachEvent("onunload", cleanupEvents);
            }
            eventRegistry.push(new EventData(obj, evType, fn));
            return r;
        };
    }
    return function () {
        return null;
    };
}();

var removeEvent = function () {
    if (window.removeEventListener) {
        return function (obj, evType, fn, useCapture) {
            obj.removeEventListener(evType, fn, useCapture);
        };
    } else if (window.detachEvent) {
        return function (obj, evType, fn, useCapture) {
            obj.detachEvent('on' + evType, fn);
        };
    }
    return function () {
        return null;
    };
}();

function cleanupEvents() {
    if (eventRegistry) {
        for (var i = 0; i < eventRegistry.length; i++) {
            var evt = eventRegistry[i];
            removeEvent(evt.element, evt.type, evt.handler, evt.useCapture);
        }
        // unlink circular refrences so they can be GC'd
        eventRegistry = null;
        removeEvent(window, "unload", cleanupEvents, false);
    }
}