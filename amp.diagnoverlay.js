/*              The MIT License (MIT)

Copyright (c) 2015 Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.                       */

(function (mediaPlayer) {
    "use strict";

    mediaPlayer.plugin('diagnoverlay', function (options) {

        //plugin level variables
        var timeupdateDisplay = "", audioBufferDataDisplay = "", videoBufferDataDisplay = "", framerate = "";
        var player = this, overlayCssClass = "amp-diagnoverlay";

        //input parameters
        var title = !!options && !!options.title ? options.title : "",
            opacity = !!options && !!options.opacity ? options.opacity : 0.5,
            bgColor = !!options && !!options.bgColor ? options.bgColor : "Black",
            x = !!options && !!options.x ? options.x : "left",
            y = !!options && !!options.y ? options.y : "top";


        /************ PLUGIN **************/

        var Component = mediaPlayer.getComponent("Component");      

        //create overlay
        mediaPlayer.Overlay = amp.extend(Component, {
            init: function (player, options) {
                Component.call(this, player, options);
            }
        });

        mediaPlayer.Overlay.prototype.createEl = function () {
            var el = Component.prototype.createEl.call(this, "div", { className: overlayCssClass });
            el.style.opacity = opacity;
            el.style.backgroundColor = bgColor;
            //el.style.borderRadius = '14px';       // standard
            //el.style.MozBorderRadius = '15px';    // Mozilla
            //el.style.WebkitBorderRadius = '15px'; // WebKit
            el.onload = function () {
                updateOverlay();
            };

            //image
            if (!!options && !!options.image && options.image.length > 0) {
                var thumbnail = document.createElement('img');
                thumbnail.id = "thumbnail";
                thumbnail.style.visibility = "visible";
                thumbnail.src = options.image;
                thumbnail.style.width = "30px";
                el.appendChild(thumbnail);
            }

            var div = videojs.createEl("div", {});
            div.onload = function () {
                updateOverlay();
            };

            el.appendChild(div);

            this.container = el;
            this.div = div;

            return el;
        };

        player.ready(function () {  //main function
            var overlay = new mediaPlayer.Overlay(player);
            player.overlay = player.addChild(overlay);
            registerOverlayEvents();
        });

        /************ FORMATTING **************/

        //add commas to an integer number in string format. It will handle whole numbers or decimal numbers. You can pass it either a number or a string.
        function addCommas(str) {
            var output = str;
            if (str) {
                var parts = (str + "").split("."),
                    main = parts[0],
                    len = main.length,
                    output = "",
                    i = len - 1;

                while (i >= 0) {
                    output = main.charAt(i) + output;
                    if ((len - i) % 3 === 0 && i > 0) {
                        output = "," + output;
                    }
                    --i;
                }
                // put decimal part back
                if (parts.length > 1) {
                    output += "." + parts[1];
                }
            }
            return output;
        }

        /************ POSITION / SIZE **************/

        //function showOverlay() {
        //    updateOverlay();

        //    player.overlay.removeClass("vjs-user-inactive");
        //    player.overlay.addClass("vjs-user-active");
        //}

        //function hideOverlay() {
        //    player.overlay.removeClass("vjs-user-active");
        //    player.overlay.removeClass("vjs-user-inactive");
        //    player.overlay.addClass("vjs-user-hide");
        //}

        function getX(innerdiv, x) {   
            var videoElement = player.el();
            var position; 
            switch (x)
            {
                case "center":
                    position = (videoElement.clientWidth / 2) - (innerdiv.parentElement.clientWidth / 2);
                    break;
                case "right":
                    position = videoElement.clientWidth - innerdiv.parentElement.clientWidth - 1;
                    break;
                default:
                    position = 0;
                    break;
            }

            return position;
        }

        function getY(innerdiv, y) {
            var position;
            var videoElement = player.el(),
            controlBarHeight = player.controlBar.el().clientHeight || 31,
            progressControlHeight = player.controlBar.progressControl.el().clientHeight || 12;

            switch(y)
            {
                case "middle":
                    position = (videoElement.clientHeight / 2) - (innerdiv.parentElement.clientHeight / 2) - (controlBarHeight / 2) - (progressControlHeight / 2);
                    break;
                case "bottom":
                    position = videoElement.clientHeight - innerdiv.parentElement.clientHeight - controlBarHeight - progressControlHeight;
                    break;
                default:
                    position = 0
                    break;
            }

            return position;
        }

        function updateOverlayMaxSize(innerdiv) {
            // Update image max size according video size
            var videoElement = player.el();
            if ((videoElement.clientHeight < innerdiv.parentElement.clientHeight) || (videoElement.clientWidth < innerdiv.parentElement.clientWidth)) {
                innerdiv.style.maxHeight = videoElement.clientHeight + 'px';
                innerdiv.style.maxWidth = videoElement.clientWidth + 'px';
            } else {
                innerdiv.style.maxHeight = '100%';
                innerdiv.style.maxWidth = '100%';
            }
        }

        function updateOverlayPosition(outerdiv, innerdiv) {
            // Update DIV based on image values (now calculated because it was added to the DOM)
            outerdiv.style.left = getX(innerdiv, x) + 'px';
            outerdiv.style.top  = getY(innerdiv, y) + 'px';
        }

        /************ UPDATE CONTENTS **************/

        function updateOverlay() {
            //update position when the video returns from fullscreen
            player.overlay.container.style.left = '0';
            player.overlay.container.style.top = '0';

            //check framerate plugin
            var timecode;
            if (!!amp.eventName.framerateready) {
                timecode = "- current timecode: " + player.toTimecode(player.toPresentationTime(player.currentTime()));
            } else {
                timecode = "- current time: " + player.currentTime();
            }

            timeupdateDisplay = timecode + "\n" +
                                "- current media time: " + player.currentMediaTime().toFixed(3) + "\n" +
                                "- current absolute time: " + player.currentAbsoluteTime().toFixed(3) + "\n" +
                                "- current playback bitrate: " + addCommas(player.currentPlaybackBitrate()) + "\n" +
                                "- current download bitrate: " + addCommas(player.currentDownloadBitrate()) + "\n" +
                                "- current tech: " + player.currentTechName() + "\n" +
                                "- current type: " + player.currentType() + "\n";
                                "- video size (w x h): " + player.videoWidth() + " x " + player.videoHeight() + "\n";
            updateContent();

            updateOverlayMaxSize(player.overlay.div);
            updateOverlayPosition(player.overlay.container, player.overlay.div);
        }
        
        function updateContent()
        {
            var displayTitle = !!title && title.length > 0? title + "\n" : "";
            player.overlay.div.innerText = displayTitle + timeupdateDisplay + audioBufferDataDisplay + videoBufferDataDisplay + framerate;
        }   

        /************ EVENTS **************/

        function overlayEventHandler(evt) {
            switch (evt.type) {
                case amp.eventName.loadedmetadata:
                    var videoBufferData = player.videoBufferData();
                    if (videoBufferData) {
                        videoBufferData.addEventListener(amp.bufferDataEventName.downloadcompleted, videoBufferDataEventHandler1);
                        //videoBufferData.addEventListener(amp.bufferDataEventName.downloadfailed, videoBufferDataEventHandler1);
                        //videoBufferData.addEventListener(amp.bufferDataEventName.downloadrequested, videoBufferDataEventHandler1);
                    }
                    var audioBufferData = player.audioBufferData();
                    if (audioBufferData) {
                        audioBufferData.addEventListener(amp.bufferDataEventName.downloadcompleted, audioBufferDataEventHandler1);
                        //audioBufferData.addEventListener(amp.bufferDataEventName.downloadfailed, audioBufferDataEventHandler1);
                        //audioBufferData.addEventListener(amp.bufferDataEventName.downloadrequested, audioBufferDataEventHandler1);
                    }
                    break;
                case amp.eventName.timeupdate:
                case amp.eventName.fullscreenchange:
                    updateOverlay();
                    break;
                case amp.eventName.framerateready:
                    //framerate plugin does not work for AES-128 protected stream
                    framerate = "- frame rate: " + player.frameRate().toFixed(3) + "\n" +
                                "- time scale: " + addCommas(player.timeScale());
                    break;
                default:
                    break;
            }
        }

        function audioBufferDataEventHandler1(evt) {
            processBufferData1(evt, "audio");
        }

        function videoBufferDataEventHandler1(evt) {
            processBufferData1(evt, "video");
        }

        function processBufferData1(evt, type) {
            var bufferData;
            switch (type) {
                case "audio":
                    bufferData = player.audioBufferData();
                    audioBufferDataDisplay = "- audio download size (bytes): " + addCommas(bufferData.downloadCompleted.totalBytes) + "\n" +
                                             "- audio download time (ms): " + addCommas(bufferData.downloadCompleted.totalDownloadMs) + "\n" +
                                             "- audio buffer level (sec): " + bufferData.bufferLevel.toFixed(3) + "\n";
                    if (!!bufferData.downloadCompleted && !!bufferData.downloadCompleted.measuredBandwidth) {
                        audioBufferDataDisplay += "- audio measured bandwidth (bps): " + addCommas(bufferData.downloadCompleted.measuredBandwidth.toFixed(0)) + "\n";
                                                //"- audio perceived bandwidth (bps): " + addCommas(bufferData.perceivedBandwidth);
                    }
                    break;
                default:
                    bufferData = player.videoBufferData();
                    videoBufferDataDisplay = "- video download size (bytes): " + addCommas(bufferData.downloadCompleted.totalBytes) + "\n" +
                                             "- video download time (ms): " + addCommas(bufferData.downloadCompleted.totalDownloadMs) + "\n" +
                                             "- video buffer level (sec): " + bufferData.bufferLevel.toFixed(3) + "\n" +
                                             "- video measured bandwidth (bps): " + addCommas(bufferData.downloadCompleted.measuredBandwidth.toFixed(0)) + "\n" +
                                             "- video perceived bandwidth (bps): " + addCommas(bufferData.perceivedBandwidth.toFixed(0)) + "\n";

                    switch (evt.type) {
                        case amp.bufferDataEventName.downloadrequested:                     
                            break;
                        case amp.bufferDataEventName.downloadcompleted:
                            if (!!bufferData && !!bufferData.downloadRequested) {
                                videoBufferDataDisplay += "- req url: ... " + bufferData.downloadRequested.url.substr(bufferData.downloadRequested.url.length - 42) + "\n";
                            }
                            if (!!bufferData && !!bufferData.downloadCompleted) {
                                var responseHeaders = bufferData.downloadCompleted.responseHeaders;
                                if (!!responseHeaders && !!responseHeaders.Expires) {
                                    videoBufferDataDisplay += "- expires: " + responseHeaders.Expires + "\n";
                                }
                                if (!!responseHeaders && !!responseHeaders.Pragma) {
                                    videoBufferDataDisplay += "- pragma: " + responseHeaders.Pragma + "\n";
                                }
                            }
                            break;
                        case amp.bufferDataEventName.downloadfailed:
                            if (!!bufferData && !!bufferData.downloadFailed) {
                                videoBufferDataDisplay += "- download failure: code: " + bufferData.downloadFailed.code + ", message: " + bufferData.downloadFailed.message + "\n";
                            }
                            break;
                        default:
                            break;
                    }
                    break;
            }

            updateContent();
        }

        //register events to handle for diagnoverlay
        function registerOverlayEvents()
        {
            var events;
            if (!!amp.eventName.framerateready) {
                events = [amp.eventName.loadedmetadata,
                          amp.eventName.timeupdate,
                          amp.eventName.fullscreenchange,
                          amp.eventName.framerateready,  //this requires the framerate plugin
                ];
            } else {
                events = [amp.eventName.loadedmetadata,
                          amp.eventName.timeupdate,
                          amp.eventName.fullscreenchange,
                ];
            }

            for (var i = 0; i < events.length; i++) {
                player.addEventListener(events[i], overlayEventHandler);
            }
        }
     
    });
}(window.amp));
