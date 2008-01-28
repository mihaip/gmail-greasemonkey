// ==UserScript==
// @name           Gmail Macros (New)
// @namespace      http://persistent.info
// @include        http://mail.google.com/*
// @include        https://mail.google.com/*
// ==/UserScript==

window.addEventListener('load', function() {
  if (unsafeWindow.gmonkey) {
    unsafeWindow.gmonkey.load('1.0', init)
  }
}, true);

var UNREAD_COUNT_RE = /\s+\(\d+\)?$/;

var MORE_ACTIONS_MENU_HEADER_CLASS = "QOD9Ec";
var MORE_ACTIONS_MENU_BODY_CLASS = "Sn99bd";
var MORE_ACTIONS_MENU_ITEM_CLASS = "SenFne";

var LABEL_ITEM_CLASS_NAME = "yyT6sf";

var MARK_AS_READ_ACTION = "1";
var ARCHIVE_ACTION = "7";
var ADD_LABEL_ACTION = "12";
var REMOVE_LABEL_ACTION = "13";

// Map from nav pane names to location names
var SPECIAL_LABELS = {
  "Inbox": "inbox",
  "Starred": "starred",
  "Chats": "chats",
  "Sent Mail": "sent",
  "Drafts": "drafts",
  "All Mail": "all",
  "Spam": "spam",
  "Trash": "trash"
}

const LABEL_ACTIONS = {
  // g: go to label
  71: {
    label: "Go to label",
    func: function(labelName) {
      if (labelName in SPECIAL_LABELS) {
        top.location.hash = "#" + SPECIAL_LABELS[labelName];      
      } else {
        top.location.hash = "#label/" + encodeURIComponent(labelName);
      }
    }
  },
  // l: apply label
  76: {
    label: "Apply label",
    func: function (labelName) {
      clickMoreActionsMenuItem(labelName, ADD_LABEL_ACTION);
    },
  },
  // b: remove label
  66: {
    label: "Remove label",
    func: function (labelName) {
      clickMoreActionsMenuItem(labelName, REMOVE_LABEL_ACTION);
    }
  }
};

const ACTIONS = {
  // d: archive and mark as read, i.e. discard
  68: function() {
    clickMoreActionsMenuItem("Mark as read", MARK_AS_READ_ACTION);
    
    // Wait for the mark as read action to complete
    window.setTimeout(function() {
      // Just re-use the always archive action
      ACTIONS[69]();
    }, 500);
  },
  // f: focus (only show unread and inbox messages)
  70: function() {
    // Can only focus when in threadlist views
    if (gmail.getActiveViewType() != 'tl') return;
    
    var loc = top.location.hash;
    if (loc.length <= 1) return;
    loc = loc.substring(1);
    
    var search = getSearchForLocation(loc);
    
    if (search === null) {
      return;
    }
    
    search += " {in:inbox is:starred is:unread} -is:muted";
    
    top.location.hash = "#search/" + search;
  }
};

var LOC_TO_SEARCH = {
  "inbox": "in:inbox",
  "starred": "is:starred",
  "chats": "is:chat",
  "sent": "from:me",
  "drafts": "is:draft",
  "all": "",
  "spam": "in:spam",
  "trash": "in:trash"
};

var LABEL_PREFIX = "label/";

function getSearchForLocation(loc) {
  if (loc in LOC_TO_SEARCH) {
    return LOC_TO_SEARCH[loc];
  }
  
  if (loc.indexOf(LABEL_PREFIX) == 0) {
    var labelName = loc.substring(LABEL_PREFIX.length);
    
    // Normalize spaces to dashes, since that's what Gmail wants for searches
    labelName = labelName.replace(/\+/g, "-");

    return "label:" + labelName;
  }
  
  return null;
}

// TODO(mihaip): too many global variables, use objects
var banner = null;
var gmail = null;

var labelInput = null;
var activeLabelAction = null;
var lastPrefix = null;
var selLabelIndex = null;

function getDoc() {
  return gmail.getNavPaneElement().ownerDocument;
}

function newNode(tagName) {
  return getDoc().createElement(tagName);
}

function getNode(id) {
  return getDoc().getElementById(id);
}

function getFirstVisibleNode(nodes) {
  for (var i = 0, node; node = nodes[i]; i++) {
    if (node.offsetHeight) return node;
  }
  
  return null;
}

function simulateClick(node, eventType) {
  var event = node.ownerDocument.createEvent("MouseEvents");
  event.initMouseEvent(eventType,
                       true, // can bubble
                       true, // cancellable
                       node.ownerDocument.defaultView,
                       1, // clicks
                       50, 50, // screen coordinates
                       50, 50, // client coordinates
                       false, false, false, false, // control/alt/shift/meta
                       0, // button,
                       node);

  node.dispatchEvent(event);
}

function clickMoreActionsMenuItem(menuItemText, menuItemAction) {
  var moreActionsMenu = getFirstVisibleNode(getNodesByTagNameAndClass(
      getDoc().body, "div", MORE_ACTIONS_MENU_HEADER_CLASS));
  
  if (!moreActionsMenu) {
    alert("Couldn't find the menu header node");
    return;  
  }
  
  simulateClick(moreActionsMenu, "mousedown");
  
  var menuBodyNodes = getNodesByTagNameAndClass(
      getDoc().body, "div", MORE_ACTIONS_MENU_BODY_CLASS);
  var menuBodyNode = getFirstVisibleNode(menuBodyNodes);
  
  if (!menuBodyNode) {
    alert("Couldn't find the menu body node");
    return;
  }
  
  var menuItemNodes = getNodesByTagNameAndClass(
      menuBodyNode, "div", MORE_ACTIONS_MENU_ITEM_CLASS);
  
  for (var i = 0; menuItemNode = menuItemNodes[i]; i++) {
    if (menuItemNode.textContent == menuItemText &&
        menuItemNode.getAttribute("act") == menuItemAction) {
      simulateClick(menuItemNode, "mouseup");
      return; 
    }
  }
  
  alert("Couldn't find the menu item node '" + menuItemText + "'");
}

function init(g) {
  gmail = g;  
  banner = new Banner();

  getDoc().defaultView.addEventListener('keydown', keyHandler, false);
}

function keyHandler(event) {
  // Apparently we still see Firefox shortcuts like control-T for a new tab - 
  // checking for modifiers lets us ignore those
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  
  // We also don't want to interfere with regular user typing
  if (event.target && event.target.nodeName) {
    var targetNodeName = event.target.nodeName.toLowerCase();
    if (targetNodeName == "textarea" ||
        (targetNodeName == "input" && event.target.type &&
         (event.target.type.toLowerCase() == "text" ||
          event.target.type.toLowerCase() == "file"))) {
      return;
    }
  }
  
  var k = event.keyCode;
  
  if (k in LABEL_ACTIONS) {
    if (activeLabelAction) {
      endLabelAction();
      return
    } else {
      activeLabelAction = LABEL_ACTIONS[k];
      beginLabelAction();
      return;
    }
  }
  
  if (k in ACTIONS) {
    ACTIONS[k]();
    return;
  }
  
  return;
}

function beginLabelAction() {
  // TODO(mihaip): make sure the labels nav pane is open
  
  banner.show();
  banner.setFooter(activeLabelAction.label);

  lastPrefix = null;
  selLabelIndex = 0;
  dispatchedActionTimeout = null;

  labelInput = makeLabelInput();
  labelInput.addEventListener("keyup", updateLabelAction, false);
  // we want escape, clicks, etc. to cancel, which seems to be equivalent to the
  // field losing focus
  labelInput.addEventListener("blur", endLabelAction, false);
}

function makeLabelInput() {
  labelInput = newNode("input");
  labelInput.type = "text";
  labelInput.setAttribute("autocomplete", "off");
  with (labelInput.style) {
    position = "fixed"; // We need to use fixed positioning since we have to ensure
                        // that the input is not scrolled out of view (since
                        // Gecko will scroll for us if it is).
    top = "0";
    left = "-300px";
    width = "200px";
    height = "20px";
    zIndex = "1000";
  }

  getDoc().body.appendChild(labelInput);
  labelInput.focus();
  labelInput.value = "";
  
  return labelInput;
}

function endLabelAction() {
  if (dispatchedActionTimeout) return;
  
  // TODO(mihaip): re-close label box if necessary
  
  banner.hide();

  if (labelInput) {
    labelInput.parentNode.removeChild(labelInput);
    labelInput = null;
  }
  
  activeLabelAction = null;
}

function updateLabelAction(event) {
  // We've already dispatched the action, the user is just typing away
  if (dispatchedActionTimeout) return;
  
  var labels = getLabels();
  var selectedLabels = [];
  
  // We need to skip the label shortcut that got us here
  var labelPrefix = labelInput.value.substring(1).toLowerCase();

  // We always want to reset the cursor position to the end of the text
  // field, since some of the keys that we support (arrows) would
  // otherwise change it
  labelInput.selectionStart = labelInput.selectionEnd = labelPrefix.length + 1;

  if (labelPrefix.length == 0) {
    banner.update("");
    return;
  }
  
  for (var i = 0; i < labels.length; i++) {
    label = labels[i];
    
    if (label.toLowerCase().indexOf(labelPrefix) == 0) {
      selectedLabels.push(label);
    } 
  }
  
  if (labelPrefix != lastPrefix) {
    lastPrefix = labelPrefix;
    selLabelIndex = 0;
  }
  
  if (selectedLabels.length == 0) {
    banner.update(labelPrefix);
    return;
  }
  
  if (event.keyCode == 13 || selectedLabels.length == 1) {
    var selectedLabelName = selectedLabels[selLabelIndex];
  
    // Tell the user what we picked
    banner.update(selectedLabelName);

    // Invoke the action straight away, but keep the banner up so the user can
    // see what was picked, and so that extra typing is caught.
    activeLabelAction.func(selectedLabelName);
    dispatchedActionTimeout = window.setTimeout(function() {
      dispatchedActionTimeout = null;
      endLabelAction()
    }, 500);
    return;
  } else if (event.keyCode == 40) { // down
    selLabelIndex = (selLabelIndex + 1) % selectedLabels.length;
  } else if (event.keyCode == 38) { // up
    selLabelIndex = (selLabelIndex + selectedLabels.length - 1) %
        selectedLabels.length;
  }

  var selectedLabelName = selectedLabels[selLabelIndex];
  
  var highlightedSelectedLabelName = selectedLabelName.replace(
      new RegExp("(" + labelPrefix + ")", "i"), "<u>$1</u>");
  var labelPosition = " <small>(" + 
      (selLabelIndex + 1) + "/" + selectedLabels.length + ")</small>";
  
  banner.update(highlightedSelectedLabelName + labelPosition);
}

function getLabels() {  
  var navPaneNode = gmail.getNavPaneElement();
  
  var labelNodes = getNodesByTagNameAndClass(
      navPaneNode, "div", LABEL_ITEM_CLASS_NAME);

  var labels = [];

  for (var i = 0, labelNode; labelNode = labelNodes[i]; i++) {
    var labelName = labelNode.textContent.replace(UNREAD_COUNT_RE, "");
    
    labels.push(labelName);
  }
  
  return labels;
}

function evalXPath(expression, rootNode) {
  try {
    var xpathIterator = rootNode.ownerDocument.evaluate(
      expression,
      rootNode,
      null, // no namespace resolver
      XPathResult.ORDERED_NODE_ITERATOR_TYPE,
      null); // no existing results
  } catch (err) {
    GM_log("Error when evaluating XPath expression '" + expression + "'" +
           ": " + err);
    return null;
  }
  var results = [];

  // Convert result to JS array
  for (var xpathNode = xpathIterator.iterateNext(); 
       xpathNode; 
       xpathNode = xpathIterator.iterateNext()) {
    results.push(xpathNode);
  }
    
  return results;
}

function getNodesByTagNameAndClass(rootNode, tagName, className) {
  var expression = 
      ".//" + tagName + 
      "[contains(concat(' ', @class, ' '), ' " + className + " ')]";
  
  return evalXPath(expression, rootNode);
}

function Banner() {
  function getNodeSet() {
    var boxNode = newNode("div");
    boxNode.className = "banner";
    with (boxNode.style) {
      display = "none";
      position = "fixed";
      left = "10%";
      margin = "0 10% 0 10%";
      width = "60%";
      textAlign = "center";
      MozBorderRadius = "10px";
      padding = "10px";
      color = "#fff";
    }
    
    var messageNode = newNode("div");
    with (messageNode.style) {
      fontSize = "24px";
      fontWeight = "bold";
      fontFamily = "Lucida Grande, Trebuchet MS, sans-serif";
      margin = "0 0 10px 0";
    }
    boxNode.appendChild(messageNode);
  
    var taglineNode = newNode("div");
    with (taglineNode.style) {
      fontSize = "13px";
      margin = "0";
      position = "absolute";
      right = "0.2em";
      bottom = "0";
      MozOpacity = "0.5";
    }
    taglineNode.innerHTML = 'LabelSelector<span style="color:red">9001</span>';
    boxNode.appendChild(taglineNode);
    
    var footerNode = newNode("div");
    with (footerNode.style) {
      fontSize = "13px";
    }
    boxNode.appendChild(footerNode);
    
    return boxNode;
  }

  this.backgroundNode = getNodeSet();
  this.backgroundNode.style.background = "#000";
  this.backgroundNode.style.MozOpacity = "0.70";
  this.backgroundNode.style.zIndex = 100;
  for (var child = this.backgroundNode.firstChild; 
       child; 
       child = child.nextSibling) {
    child.style.visibility = "hidden";
  }
  
  this.foregroundNode = getNodeSet();
  this.foregroundNode.style.zIndex = 101;
}

Banner.prototype.hide = function() {
  this.backgroundNode.style.display = 
    this.foregroundNode.style.display = "none";
}

Banner.prototype.show = function(opt_isBottomAnchored) {
  this.update("");
  getDoc().body.appendChild(this.backgroundNode);
  getDoc().body.appendChild(this.foregroundNode);

  this.backgroundNode.style.bottom = this.foregroundNode.style.bottom = 
    opt_isBottomAnchored ? "10%" : "";
  this.backgroundNode.style.top = this.foregroundNode.style.top = 
    opt_isBottomAnchored ? "" : "50%";

  this.backgroundNode.style.display = 
    this.foregroundNode.style.display = "block";
}

Banner.prototype.update = function(message) {
  if (message.length) {
    this.backgroundNode.firstChild.style.display = 
      this.foregroundNode.firstChild.style.display = "inline";
  } else {
    this.backgroundNode.firstChild.style.display = 
      this.foregroundNode.firstChild.style.display = "none";
  }
  this.backgroundNode.firstChild.innerHTML = 
    this.foregroundNode.firstChild.innerHTML = message;
}

Banner.prototype.setFooter = function(text) {
  this.backgroundNode.lastChild.innerHTML = 
    this.foregroundNode.lastChild.innerHTML = text;  
}
