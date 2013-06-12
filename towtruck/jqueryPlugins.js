/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery"], function ($) {
  // This isn't really a "module" since it just patches jQuery itself

  // towtruck animations go here...

  $.fn.easeTo = function (y) {
    return this.animate({
      scrollTop: y
    }, {
      duration: 400,
      easing: "swing"
    });
  };


  // animate avatar poping into the dock / telescope in the avatar


  // animate avatar exiting the dock / telescope out the avatar


  // animate the participant cursor


  /* Pop in window from dock button: */
  $.fn.popinWindow = function () {
    return this.animate({
      opacity: 0,
      right: '+=50'
    }, {
      duration: 400,
      easing: "linear"
    });
  };


  /* Slide in notification window: */
  $.fn.slideIn = function () {
    this.css({
      left: "+=74px",
      opacity: 1,
      "zIndex": 8888
    });
    return this.animate({
      "left": "-=74px",
       opacity: 1,
       "zIndex": 9999
      }, "fast");
    // return this.animate({
    //   opacity: 1,
    //   right: '+=50px'
    // }, {
    //   duration: 400,
    //   easing: "linear"
    // });
  };

  /* Used to fade away notification windows: */
  $.fn.fadeOut = function (time) {
    return this.animate({
      opacity: 0
    }, {
      duration: time || 1000,
      easing: "linear"
    });
  };

});
