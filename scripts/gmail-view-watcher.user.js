// Copyright (c) 2007, Google Inc.
// Released under the BSD license:
// http://www.opensource.org/licenses/bsd-license.php
//
// ==UserScript==
// @name          Gmail View Watcher
// @namespace     http://mail.google.com/
// @description   Adds a nav box to Gmail which monitors the current view.
// @include       http://mail.google.com/*
// @include       https://mail.google.com/*
// ==/UserScript==

window.addEventListener('load', function() {
  if (unsafeWindow.gmonkey) {
    unsafeWindow.gmonkey.load('1.0', function(gmail) {
      function setViewType() {
        var str = '';
        switch (gmail.getActiveViewType()) {
          case 'tl': str = 'Threadlist'; break;
          case 'cv': str = 'Conversation'; break;
          case 'co': str = 'Compose'; break;
          case 'ct': str = 'Contacts'; break;
          case 's': str = 'Settings'; break;
          default: str = 'Unknown';
        }
        module.setContent(str);
      }
      var module = gmail.addNavModule('View Monitor');
      gmail.registerViewChangeCallback(setViewType);
      setViewType();
    });
  }
}, true);
