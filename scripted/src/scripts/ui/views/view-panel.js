/**
 * @fileOverview View panel functions and UI.
 * @author David Huynh
 * @author <a href="mailto:ryanlee@zepheira.com">Ryan Lee</a>
 */

/**
 * @constructor
 * @class
 * @param {Element} div
 * @param {Exhibit.UIContext} uiContext
 */
Exhibit.ViewPanel = function(div, uiContext) {
    this._uiContext = uiContext;
    this._div = div;
    this._uiContextCache = {};
    
    this._viewConstructors = [];
    this._viewConfigs = [];
    this._viewLabels = [];
    this._viewTooltips = [];
    this._viewDomConfigs = [];
    
    this._viewIndex = 0;
    this._view = null;

    this._registered = false;
};

/**
 * @private
 * @constant
 */
Exhibit.ViewPanel._registryKey = "viewPanel";

/**
 * @private
 * @param {jQuery.Event} evt
 * @param {Exhibit.Registry} reg
 */
Exhibit.ViewPanel._registerComponent = function(evt, reg) {
    if (!reg.hasRegistry(Exhibit.ViewPanel._registryKey)) {
        reg.createRegistry(Exhibit.ViewPanel._registryKey);
    }
};

/**
 * @param {Object} configuration
 * @param {Element} div
 * @param {Exhibit.UIContext} uiContext
 * @returns {Exhibit.ViewPanel}
 */
Exhibit.ViewPanel.create = function(configuration, div, uiContext) {
    var viewPanel, i, viewconfig, viewClass, label, tooltip, id, viewClassName;
    viewPanel = new Exhibit.ViewPanel(div, uiContext);
    
    if (typeof configuration.views !== "undefined") {
        for (i = 0; i < configuration.views.length; i++) {
            viewConfig = configuration.views[i];
            
            viewClass = (typeof view.viewClass !== "undefined") ?
                view.viewClass :
                Exhibit.TileView;
            if (typeof viewClass === "string") {
                viewClassName = viewClass;
                viewClass = Exhibit.UI.viewClassNameToViewClass(viewClass);
            }
            
            label = null;
            if (typeof viewConfig.viewLabel !== "undefined") {
                label = viewConfig.viewLabel;
            } else if (typeof viewConfig.label !== "undefined") {
                label = viewConfig.label;
            } else if (typeof viewClass.l10n !== "undefined" &&
                       typeof viewClass.l10n.viewLabel !== "undefined") {
                label = viewClass.l10n.viewLabel;
            } else if (typeof viewClassName !== "undefined") {
                label = viewClassName;
            } else {
                label = "[no view label set]";
            }
            
            tooltip = null;
            if (typeof viewConfig.tooltip !== "undefined") {
                tooltip = viewConfig.tooltip;
            } else if (typeof viewClass.l10n !== "undefined" &&
                       typeof viewClass.l10n.viewTooltip !== "undefined") {
                tooltip = viewClass.l10n.viewTooltip;
            } else {
                tooltip = label;
            }
            
            viewPanel._viewConstructors.push(viewClass);
            viewPanel._viewConfigs.push(viewConfig);
            viewPanel._viewLabels.push(label);
            viewPanel._viewTooltips.push(tooltip);
            viewPanel._viewDomConfigs.push(null);
        }
    }
    
    if (typeof configuration.initialView !== "undefined") {
        viewPanel._viewIndex = configuration.initialView;
    }
    
    viewPanel._setIdentifier();
    viewPanel.register();
    viewPanel._internalValidate();
    viewPanel._initializeUI();
    
    return viewPanel;
};

/**
 * @param {Element} div
 * @param {Exhibit.UIContext} uiContext
 * @returns {Exhibit.ViewPanel}
 */
Exhibit.ViewPanel.createFromDOM = function(div, uiContext) {
    var viewPanel, role, viewClass, viewClassName, viewLabel, tooltip, label, id, intialView, n;
    viewPanel = new Exhibit.ViewPanel(div, Exhibit.UIContext.createFromDOM(div, uiContext, false));
    
    $(div).children().each(function(index, elmt) {
        $(this).hide();
        role = Exhibit.getRoleAttribute(this);
        if (role === "view") {
            viewClass = Exhibit.TileView;
            viewClassName = Exhibit.getAttribute(this, "viewClass");
            if (typeof viewClassName !== "undefined" && viewClassName !== null && viewClassName.length > 0) {
                viewClass = Exhibit.UI.viewClassNameToViewClass(viewClassName);
                if (typeof viewClass === "undefined" || viewClass === null) {
                    Exhibit.Debug.warn("Unknown viewClass " + viewClassName);
                }
            }

            viewLabel = Exhibit.getAttribute(this, "viewLabel");
            label = (typeof viewLabel !== "undefined" && viewLabel !== null && viewLabel.length > 0) ?
                viewLabel :
                Exhibit.getAttribute(this, "label");
            tooltip = Exhibit.getAttribute(this, "title");
                
            if (typeof label === "undefined" || label === null) {
                if (typeof viewClass.l10n.viewLabel !== "undefined") {
                    label = viewClass.l10n.viewLabel;
                } else if (typeof viewClassName !== "undefined") {
                    label = viewClassName;
                } else {
                    label = "[no view label set]";
                }
            }
            if (typeof tooltip === "undefined" || tooltip === null) {
                if (typeof viewClass.l10n !== "undefined" &&
                    typeof viewClass.l10n.viewTooltip !== "undefined") {
                    tooltip = viewClass.l10n.viewTooltip;
                } else {
                    tooltip = label;
                }
            }
            
            viewPanel._viewConstructors.push(viewClass);
            viewPanel._viewConfigs.push(null);
            viewPanel._viewLabels.push(label);
            viewPanel._viewTooltips.push(tooltip);
            viewPanel._viewDomConfigs.push(this);
        }
    });
    
    initialView = Exhibit.getAttribute(div, "initialView");
    if (typeof initialView !== "undefined" && initialView !== null && initialView.length > 0) {
        try {
            n = parseInt(initialView, 10);
            if (!isNaN(n)) {
                viewPanel._viewIndex = n;
            }
        } catch (e) {
        }
    }
    
    viewPanel._setIdentifier();
    viewPanel.register();
    viewPanel._internalValidate();
    viewPanel._initializeUI();
    
    return viewPanel;
};

/**
 *
 */
Exhibit.ViewPanel.prototype.dispose = function() {
    if (this._view !== null) {
        this._view.dispose();
        this._view = null;
    }
    
    $(this._div).empty();
    
    this.unregister();
    this._uiContext.dispose();
    this._uiContext = null;
    this._div = null;
};

/**
 *
 */
Exhibit.ViewPanel.prototype._setIdentifier = function() {
    this._id = $(this._div).attr("id");

    if (typeof this._id === "undefined" || this._id === null) {
        this._id = Exhibit.ViewPanel._registryKey
            + "-"
            + this._uiContext.getCollection().getID()
            + "-"
            + this._uiContext.getExhibit().getRegistry().generateIdentifier(
                Exhibit.ViewPanel._registryKey
            );
    }
};

/**
 * 
 */
Exhibit.ViewPanel.prototype.register = function() {
    if (!this._uiContext.getExhibit().getRegistry().isRegistered(
        Exhibit.ViewPanel._registryKey,
        this.getID()
    )) {
        this._uiContext.getExhibit().getRegistry().register(
            Exhibit.ViewPanel._registryKey,
            this.getID(),
            this
        );
        this._registered = true;
    }
};

/**
 *
 */
Exhibit.ViewPanel.prototype.unregister = function() {
    this._uiContext.getExhibit().getRegistry().unregister(
        Exhibit.ViewPanel._registryKey,
        this.getID()
    );
    this._registered = false;
};

/**
 * @returns {String}
 */
Exhibit.ViewPanel.prototype.getID = function() {
    return this._id;
};

/**
 *
 */
Exhibit.ViewPanel.prototype._internalValidate = function() {
    if (this._viewConstructors.length === 0) {
        this._viewConstructors.push(Exhibit.TileView);
        this._viewConfigs.push({});
        this._viewLabels.push(Exhibit.TileView.l10n.viewLabel);
        this._viewTooltips.push(Exhibit.TileView.l10n.viewTooltip);
        this._viewDomConfigs.push(null);
    }
    
    this._viewIndex = 
        Math.max(0, Math.min(this._viewIndex, this._viewConstructors.length - 1));
};

/**
 *
 */
Exhibit.ViewPanel.prototype._initializeUI = function() {
    var div, self;
    div = $("<div>");
    if ($(this._div).children().length > 0) {
        $(this._div).prepend(div);
    } else {
        $(this._div).append(div);
    }
    
    self = this;
    this._dom = Exhibit.ViewPanel.constructDom(
        $(this._div).children().get(0),
        this._viewLabels,
        this._viewTooltips,
        function(index) {
            self._selectView(index);
        }
    );
    
    this._createView();
};

/**
 *
 */
Exhibit.ViewPanel.prototype._createView = function() {
    var viewContainer, viewDiv, index, context;
    viewContainer = this._dom.getViewContainer();
    $(viewContainer).empty();

    viewDiv = $("<div>");
    $(viewContainer).append(viewDiv);
    
    index = this._viewIndex;
    context = this._uiContextCache[index] || this._uiContext;
    try {
        if (this._viewDomConfigs[index] !== null) {
            this._view = this._viewConstructors[index].createFromDOM(
                this._viewDomConfigs[index],
                viewContainer, 
                context
            );
        } else {
            this._view = this._viewConstructors[index].create(
                this._viewConfigs[index],
                viewContainer, 
                context
            );
        }
    } catch (e) {
        Exhibit.Debug.log("Failed to create view " + this._viewLabels[index]);
        Exhibit.Debug.exception(e);
    }
    
    this._uiContextCache[index] = this._view._uiContext;
    this._view.setLabel(this._viewLabels[index]);
    this._view.setViewPanel(this);

    this._dom.setViewIndex(index);
};

/**
 * @param {Number} newIndex
 */
Exhibit.ViewPanel.prototype._switchView = function(newIndex) {
    if (this._view !== null) {
        this._view.dispose();
        this._view = null;
    }
    this._viewIndex = newIndex;
    this._createView();
};

/**
 * @param {Number} newIndex
 */
Exhibit.ViewPanel.prototype._selectView = function(newIndex) {
    var oldIndex, self;
    oldIndex = this._viewIndex;
    self = this;
    Exhibit.History.pushComponentState(
        this,
        Exhibit.ViewPanel._registryKey,
        this.exportState(this.makeState(newIndex)),
        Exhibit.ViewPanel.l10n.createSelectViewActionTitle(self._viewLabels[newIndex]),
        true
    );
};

/**
 * @param {String} itemID
 * @param {Array} propertyEntries
 * @param {Exhibit.Database} database
 * @returns {Array}
 */
Exhibit.ViewPanel.getPropertyValuesPairs = function(itemID, propertyEntries, database) {
    var pairs, enterPair, i, entry;
    pairs = [];
    enterPair = function(propertyID, forward) {
        var property, values, count, itemValues, pair;
        property = database.getProperty(propertyID);
        values = forward ? 
            database.getObjects(itemID, propertyID) :
            database.getSubjects(itemID, propertyID);
        count = values.size();
        
        if (count > 0) {
            itemValues = property.getValueType() === "item";
            pair = { 
                propertyLabel:
                    forward ?
                        (count > 1 ? property.getPluralLabel() : property.getLabel()) :
                        (count > 1 ? property.getReversePluralLabel() : property.getReverseLabel()),
                valueType:  property.getValueType(),
                values:     []
            };
            
            if (itemValues) {
                values.visit(function(value) {
                    var label = database.getObject(value, "label");
                    pair.values.push(typeof label !== "undefined" && label !== null ? label : value);
                });
            } else {
                values.visit(function(value) {
                    pair.values.push(value);
                });
            }
            pairs.push(pair);
        }
    };
    
    for (i = 0; i < propertyEntries.length; i++) {
        entry = propertyEntries[i];
        if (typeof entry === "string") {
            enterPair(entry, true);
        } else {
            enterPair(entry.property, entry.forward);
        }
    }
    return pairs;
};

/**
 * @param {Element} div
 * @param {Array} viewLabels
 * @param {Array} viewTooltips
 * @param {Function} onSelectView
 */
Exhibit.ViewPanel.constructDom = function(
    div,
    viewLabels,
    viewTooltips,
    onSelectView
) {
    var l10n, template, dom;
    l10n = Exhibit.ViewPanel.l10n;
    template = {
        elmt: div,
        "class": "exhibit-viewPanel exhibit-ui-protection",
        children: [
            {   tag:        "div",
                "class":  "exhibit-viewPanel-viewSelection",
                field:      "viewSelectionDiv"
            },
            {   tag:        "div",
                "class":  "exhibit-viewPanel-viewContainer",
                field:      "viewContainerDiv"
            }
        ]
    };
    dom = $.simileDOM("template", template);
    dom.getViewContainer = function() {
        return dom.viewContainerDiv;
    };
    dom.setViewIndex = function(index) {
        var appendView, i;
        if (viewLabels.length > 1) {
            $(dom.viewSelectionDiv).empty();
            
            appendView = function(i) {
                var selected, span, handler;
                selected = (i === index);
                if (i > 0) {
                    $(dom.viewSelectionDiv).append(document.createTextNode(" \u2022 "));
                }
                
                span = $("<span>");
                span.attr("class", selected ? 
                          "exhibit-viewPanel-viewSelection-selectedView" :
                          "exhibit-viewPanel-viewSelection-view")
                    .attr("title", viewTooltips[i])
                    .html(viewLabels[i]);
                
                if (!selected) {
                    handler = function(evt) {
                        onSelectView(i);
                        evt.preventDefault();
                        evt.stopPropagation();
                    };
                    span.bind("click", handler);
                }
                $(dom.viewSelectionDiv).append(span);
            };
            
            for (i = 0; i < viewLabels.length; i++) {
                appendView(i);
            }
        }
    };
    
    return dom;
};

/**
 * @param {Object} state
 * @returns {Object} state
 */
Exhibit.ViewPanel.prototype.exportState = function(state) {
    if (typeof state === "undefined" || state === null) {
        return {
            "viewIndex": this._viewIndex
        };
    } else {
        return state;
    }
};

/**
 * @param {Object} state
 * @param {Number} state.viewIndex
 */
Exhibit.ViewPanel.prototype.importState = function(state) {
    if (this.stateDiffers(state)) {
        this._switchView(state.viewIndex);
    }
};

/**
 * @param {Number} viewIndex
 * @returns {Object}
 */
Exhibit.ViewPanel.prototype.makeState = function(viewIndex) {
    return {
        "viewIndex": viewIndex
    };
};

/**
 * @param {Object} state
 * @param {Number} state.viewIndex
 * @returns {Boolean}
 */
Exhibit.ViewPanel.prototype.stateDiffers = function(state) {
    return state.viewIndex !== this._viewIndex;
};

$(document).one("registerComponents.exhibit",
                Exhibit.ViewPanel._registerComponent);
