/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery"], function ($) {
  // This isn't really a "module" since it just patches jQuery itself

  // walkthrough animations go here

  // animate avatar popping into the dock when they enter the session / telescope in the avatar
  // $.fn.avatarEnter = function (y) {
  //   return this.animate({
  //     scrollTop: y
  //   }, {
  //     duration: 400,
  //     easing: "swing"
  //   });
  // };

  // animate participant cursor and box popping in when they enter the session

  // animate avatar exiting the dock when the exit the session/ telescope out the avatar
  // animate participant cursor and box popping out when they leave the session

  // animate the participant cursor -> rotate down when they're down the page
  // animate the participant cursor -> rotate up when they're on the same frame as the user

  // animate participant typing

  /* Pop in window from dock button: */
  $.fn.popinWindow = function () {

    //start scale small
    //set css width small

    //starting position
    this.css({
      left: "+=74px",
      opacity: 1,
      "zIndex": 8888
    });
    //this.show( { effect: "scale", origin: ['bottom' , 'right'] } );
    //scale larger
    //set css height large
    //this.show( "scale", {percent: 200, direction: 'horizontal' }, 2000 );

    //animate window out
    this.animate({
      opacity: 1,
      left: "-=78px"
    }, {
      duration:60, easing:"linear"
    });
    this.queue();

    //bounce window back
    this.animate({
      left:'+=4px'
    }, {
      duration:60, easing:"linear"
    });
  };

  /* Slide in notification window: */
  $.fn.slideIn = function () {
    this.css({
      //top: "240px",
      left: "+=74px",
      opacity: 0,
      "zIndex": 8888
    });
    return this.animate({
      "left": "-=74px",
      opacity: 1,
      "zIndex": 9999
    }, "fast");
  };

  /* Move notification when another notification slides in */

  /* Used to fade away notification windows + flip the bottom of them out: */
  $.fn.fadeOut = function () {
    
    // Perspective
    //this.css('-moz-perspective:200');
    
    //opacity -> fadeout
    
    this.animate({borderSpacing: -90}, {
      step: function(now, fx) {
        $(this).css('-webkit-transform', 'rotateX('+now+'deg)')
          .css('-moz-transform', 'rotateX('+now+'deg)')
          .css('-ms-transform', 'rotateX('+now+'deg)')
          .css('-o-transform', 'rotateX('+now+'deg)')
          .css('transform', 'rotateX('+now+'deg)');
      },
      duration: "slow"
    }, 'linear').promise().then(function () {
      this.css('-webkit-transform', '');
      this.css('-moz-transform', '');
      this.css('-ms-transform', '');
      this.css('-o-transform', '');
      this.css('transform', '');
    });
    return this;

    // this.animate({
    //   opacity: 0
    // }, {
    //   duration: time || 1000,
    //   easing: "linear"
    // });

  };

  /* used when user goes down to participant cursor location on screen */
  $.fn.easeTo = function (y) {
    return this.animate({
      scrollTop: y
    }, {
      duration: 400,
      easing: "swing"
    });
  };

  $.fn.animateDockEntry = function () {

    // scale from Center is not working.  it scales from the Top Left
    // this.hide();
    var height = this.height();
    var width = this.width();
    var backgroundSize = height + 4;
    var margin = parseInt(this.css("marginLeft"), 10);
    //console.log("calculated", margin, margin + width/2);
    this.css({
      marginLeft: margin + width/2,
      height: 0,
      width: 0,
      backgroundSize: "0 0"
    });
    var self = this;
    this.animate({
      marginLeft: margin,
      height: height,
      width: width,
      backgroundSize: backgroundSize
    }, {
      duration: 600
    }).promise().then(function () {
      self.css({
        marginLeft: "",
        height: "",
        width: "",
        backgroundSize: ""
      });
    });
    return this;
    //this.show( { effect: "scale", origin: ['middle' , 'center'], duration: 5000 } );
    // expand avatar into place

  };

  $.fn.animateDockExit = function () {
    return this.animate({});
  };

  $.fn.animateCursorEntry = function () {
    // Make the cursor bubble pop in
  };

  $.fn.animateKeyboard = function () {
    
    $( ".towtruck-typing-ellipse-one" ).css("opacity","0.5");
    $( ".towtruck-typing-ellipse-two" ).css("opacity","0.5");
    $( ".towtruck-typing-ellipse-three" ).css("opacity","0.5");
         
    var count = 0;
    var interval = setInterval((function () { 
      count++;
      $( ".towtruck-typing-ellipse-one" ).animate({
        opacity: 1,
      }, 300 ).queue(function(){
        $( ".towtruck-typing-ellipse-two" ).animate({
          opacity: 1,
        }, 300 ).queue(function(){
          $( ".towtruck-typing-ellipse-three" ).animate({
            opacity: 1,
          }, 300 );
        });
      });
    }).bind(this), 1000);
    this.data("animateKeyboard", interval);
  };

  $.fn.stopKeyboardAnimation = function () {
    clearTimeout(this.data("animateKeyboard"));
    this.data("animateKeyboard", null);
  };


});
