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
        var stopEventUpdate = false;   //indate whether to stop event update in updateEvent such as when error occurs
        var events = [];               //holding all events
        var EVENTS_TO_DISPLAY = 12;
        var timeupdateDisplay = "", streamDisplay = "", audioBufferDataDisplay = "", videoBufferDataDisplay = "", framerate = "";
        var player = this, overlayCssClass = "amp-diagnoverlay";

        //input parameters
        var title = !!options && !!options.title ? options.title : "",
            opacity = !!options && !!options.opacity ? options.opacity : 0.6,
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
            el.id = "outerdiv";
            el.style.opacity = opacity;
            el.style.backgroundColor = bgColor;
            //el.style.borderRadius = '14px';       // standard
            //el.style.MozBorderRadius = '15px';    // Mozilla
            //el.style.WebkitBorderRadius = '15px'; // WebKit
            el.onload = function () {
                updateOverlay();
            };

            this.container = el;  //and this.div, this.eventdiv

            addElementsToOverlay(this);

            return el;
        };

        //add HTML elements into the overlay
        function addElementsToOverlay(overlay) {
            //image
            if (!!options && !!options.image && options.image.length > 0) {
                var thumbnail = document.createElement('img');
                thumbnail.id = "thumbnail";
                thumbnail.style.visibility = "visible";
                thumbnail.src = options.image;
                thumbnail.style.width = "30px";
                overlay.container.appendChild(thumbnail);
            }

            //top div
            var div = videojs.createEl("div", {});
            div.id = "innerdiv";
            div.onload = function () {
                updateOverlay();
            };
            overlay.container.appendChild(div);

            //event checkbox
            var checkbox = document.createElement('input');
            checkbox.type = "checkbox";
            checkbox.name = "chkbox";
            checkbox.value = "value";
            checkbox.id = "chkevent";
            checkbox.onclick = function () {
                if (this.checked) {
                    player.overlay.eventdiv.style.visibility = "visible";
                    player.overlay.eventdiv.style.display = "block";
                } else {
                    player.overlay.eventdiv.style.visibility = "hidden";
                    player.overlay.eventdiv.style.display = "none";
                }
            }

            var label = document.createElement('label')
            label.htmlFor = "chkevent";
            label.appendChild(document.createTextNode("show events or errors"));
            overlay.container.appendChild(checkbox);
            overlay.container.appendChild(label);

            //event div
            var eventdiv = videojs.createEl("div", {});
            eventdiv.id = "eventdiv";
            eventdiv.style.visibility = "hidden";
            eventdiv.style.display = "none";
            eventdiv.onload = function () {
                updateOverlay();
            };
            overlay.container.appendChild(eventdiv);

            //expose div and eventdiv
            overlay.div = div;
            overlay.eventdiv = eventdiv;
        }

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

        //get wall clock in pretty format
        function getWallClock() {
            var now = new Date();
            var clock = now.getHours() + ":" +
                        prettyPrintNum(now.getMinutes()) + ":" +
                        prettyPrintNum(now.getSeconds()) + "." +
                        prettyPrintNum(now.getMilliseconds());
            return clock;
        }

        function prettyPrintNum(number) {
            return ((number < 10) ? "0" : "") + number;
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
                innerdiv.style.maxWidth  = videoElement.clientWidth + 'px';
            } else {
                innerdiv.style.maxHeight = '100%';
                innerdiv.style.maxWidth  = '100%';
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
            var audioStream = getCurrentAudioStream(player);

            timeupdateDisplay = timecode + 
                                "\n- current media time: " + ((!!player.currentMediaTime()) ? player.currentMediaTime().toFixed(3) : "") + 
                                "\n- current absolute time: " + ((!!player.currentAbsoluteTime()) ? player.currentAbsoluteTime().toFixed(3) : "") + 
                                "\n- current playback bitrate: " + addCommas(player.currentPlaybackBitrate()) + 
                                "\n- current download bitrate: " + addCommas(player.currentDownloadBitrate()) + 
                                "\n- current audio name: " + (!!audioStream ? audioStream.name : "") + 
                                "\n- current audio codec: " + (!!audioStream ? audioStream.codec : "") + 
                                "\n- current audio bitrate: " + (!!audioStream ? addCommas(audioStream.bitrate) : "") + 
                                "\n- current audio language: " + (!!audioStream ? audioStream.language : "") + 
                                "\n- current video track size: " + player.videoWidth() + " x " + player.videoHeight();
            updateContent();

            updateOverlayMaxSize(player.overlay.div);  
            updateOverlayPosition(player.overlay.container, player.overlay.div);
        }
        
        function updateContent()
        {
            var displayTitle = !!title && title.length > 0? title + "\n" : "";
            player.overlay.div.innerText = displayTitle + timeupdateDisplay + streamDisplay + audioBufferDataDisplay + videoBufferDataDisplay + framerate;
        }

        function updateEvent(count) {
            //var clock = getWallClock();
            var length = events.length;
            if (!stopEventUpdate && length > 0 ) {
                var msg = "";
                count = Math.min(count, length)
                for (var i = length - 1; i >= length - count; i--) {
                    if (i == length - 1) {
                        msg += "- " + events[i];
                    } else {
                        msg += "\n- " + events[i];
                    }
                }

                player.overlay.eventdiv.innerText = msg;
            }

            //in case events array gets too large
            if (events.length > 10000) {
                events = [];
            }
        }

        function getCurrentAudioStream(player) {
            var audioStreamList = player.currentAudioStreamList();
            var audioStream = null;
            if (audioStreamList) {
                for (var i = 0; i < audioStreamList.streams.length; i++) {
                    if (audioStreamList.streams[i].enabled) {
                        audioStream = audioStreamList.streams[i];
                        break;
                    }
                }
            }

            return audioStream;
        }

        /************ EVENTS **************/

        function overlayEventHandler(evt) {

            //event update
            if (evt.type != amp.eventName.timeupdate) {
                events.push(evt.type);
                updateEvent(EVENTS_TO_DISPLAY);
            }

            switch (evt.type) {
                case amp.eventName.loadedmetadata:
                    var videoBufferData = player.videoBufferData();
                    if (videoBufferData) {
                        videoBufferData.addEventListener(amp.bufferDataEventName.downloadcompleted, videoBufferDataEventHandler1);
                        videoBufferData.addEventListener(amp.bufferDataEventName.downloadfailed,    videoBufferDataEventHandler1);
                        videoBufferData.addEventListener(amp.bufferDataEventName.downloadrequested, videoBufferDataEventHandler1);
                    }
                    var audioBufferData = player.audioBufferData();
                    if (audioBufferData) {
                        audioBufferData.addEventListener(amp.bufferDataEventName.downloadcompleted, audioBufferDataEventHandler1);
                        audioBufferData.addEventListener(amp.bufferDataEventName.downloadfailed,    audioBufferDataEventHandler1);
                        audioBufferData.addEventListener(amp.bufferDataEventName.downloadrequested, audioBufferDataEventHandler1);
                    }

                    //add table
                    //var matrix = [["1, 1", "1, 2", "1, 3"], ["2, 1", "2, 2", "2, 3"], ["3, 1", "3, 2", "3, 3"], ["4, 1", "4, 2", "4, 3"], ["5, 1", "5, 2", "5, 3"], ["6, 1", "6, 2", "6, 3"]];
                    //var tbl = createTable(matrix, "ztable");
                    //var div = videojs.createEl("div", {});
                    //div.id = "inner_right";
                    //div.appendChild(tbl);
                    //player.overlay.container.appendChild(div);
                    break;
                case amp.eventName.timeupdate:
                case amp.eventName.fullscreenchange:
                    updateOverlay();
                    break;
                case amp.eventName.play:
                    streamDisplay = "\n- current tech: " + player.currentTechName() + 
                                    "\n- current type: " + player.currentType();
                    break;
                case amp.eventName.framerateready:
                case amp.eventName.dropframechanged:
                    //framerate plugin does not work for AES-128 protected stream
                    framerate = "\n- frame rate: " + player.frameRate().toFixed(3) + 
                                "\n- time scale: " + addCommas(player.timeScale());
                    if (!!player.dropFrame()) {
                        framerate += "\n- drop frame: " + player.dropFrame();
                    }
                    break;
                case amp.eventName.error:
                    events.push(ErrorUtils.prettyPrintErrorObject(player.error()));
                    updateEvent(EVENTS_TO_DISPLAY + 10);
                    stopEventUpdate = true;  //some browsers will not stop on error
                    break;
                default:
                    break;
            }
        }

        //create <table> with given matrix and id
        function createTable(matrix, id) {
            // if a table with the same id exists, clean up the data first
            var tbl = document.getElementById(id);
            if (!!tbl) {
                while (tbl.rows.length > 0) {
                    tbl.deleteRow(0);
                }
            } else {
                tbl = document.createElement("table");
            }

            var tblBody = document.createElement("tbody");
            var row, cell, cellText;

            // cells creation
            for (var i = 0; i < matrix.length; i++) {
                row = document.createElement("tr");

                for (var j = 0; j < matrix[i].length; j++) {
                    cell = document.createElement("td");
                    cellText = document.createTextNode(matrix[i][j]);
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }

                tblBody.appendChild(row);
            }

            // append the <tbody> inside the <table>
            tbl.appendChild(tblBody);

            return tbl;
        }

        function audioBufferDataEventHandler1(evt) {
            processBufferData1(evt, "audio");
        }

        function videoBufferDataEventHandler1(evt) {
            processBufferData1(evt, "video");
        }

        function processBufferData1(evt, type) {
            var bufferData;                 //holding either audio or video buffer
            var downloadSize, downloadTime; //for either audio or video
            var msg;                        //messages pushed into events array
            
            switch (type) {
                case "audio":
                    bufferData = player.audioBufferData();
                    switch (evt.type) {
                        case amp.bufferDataEventName.downloadrequested:
                            msg = evt.type + ": " + type;
                            break;
                        case amp.bufferDataEventName.downloadcompleted:
                            if (!!bufferData && !!bufferData.downloadCompleted) {
                                downloadSize = addCommas(bufferData.downloadCompleted.totalBytes);
                                downloadTime = addCommas(bufferData.downloadCompleted.totalDownloadMs);
                                audioBufferDataDisplay = "\n- audio download size (bytes): " + downloadSize + 
                                                         "\n- audio download time (ms): " + downloadTime + 
                                                         "\n- audio buffer level (sec): " + bufferData.bufferLevel.toFixed(3);
                                if (!!bufferData.downloadCompleted && !!bufferData.downloadCompleted.measuredBandwidth) {
                                    audioBufferDataDisplay += "\n- audio measured bandwidth (bps): " + addCommas(bufferData.downloadCompleted.measuredBandwidth.toFixed(0));
                                    //"- audio perceived bandwidth (bps): " + addCommas(bufferData.perceivedBandwidth);
                                }
                            }
                            msg = evt.type + ": " + type;
                            msg += ", " + downloadSize + " B in " + downloadTime + " ms";
                            break;
                        case amp.bufferDataEventName.downloadfailed:
                            //if (!!bufferData && !!bufferData.downloadFailed) {
                            //    videoBufferDataDisplay += "- download failure: code: " + bufferData.downloadFailed.code + ", message: " + bufferData.downloadFailed.message + "\n";
                            //}
                            msg = "[FAILURE] " + evt.type + ": " + type;
                        default:
                            break;
                    }
                    break;  //audio
                default:  //video
                    bufferData = player.videoBufferData();
                    switch (evt.type) {
                        case amp.bufferDataEventName.downloadrequested:
                            msg = evt.type + ": " + type;
                            break;
                        case amp.bufferDataEventName.downloadcompleted:
                            if (!!bufferData && !!bufferData.downloadCompleted) {
                                downloadSize = addCommas(bufferData.downloadCompleted.totalBytes);
                                downloadTime = addCommas(bufferData.downloadCompleted.totalDownloadMs);
                                videoBufferDataDisplay = "\n- video download size (bytes): " + downloadSize +
                                                         "\n- video download time (ms): " + downloadTime +
                                                         "\n- video buffer level (sec): " + bufferData.bufferLevel.toFixed(3) + 
                                                         "\n- video measured bandwidth (bps): " + addCommas(bufferData.downloadCompleted.measuredBandwidth.toFixed(0)) + 
                                                         "\n- video perceived bandwidth (bps): " + addCommas(bufferData.perceivedBandwidth.toFixed(0));
                                //URL
                                videoBufferDataDisplay += "\n- req url: ... " + bufferData.downloadRequested.url.substr(bufferData.downloadRequested.url.length - 42);
                                //response headers
                                var responseHeaders = bufferData.downloadCompleted.responseHeaders;
                                if (!!responseHeaders && !!responseHeaders.Expires) {
                                    videoBufferDataDisplay += "\n- expires: " + responseHeaders.Expires;
                                }
                                if (!!responseHeaders && !!responseHeaders.Pragma) {
                                    videoBufferDataDisplay += "\n- pragma: " + responseHeaders.Pragma;
                                }
                            }
                            msg = evt.type + ": " + type;
                            msg += ", " + downloadSize + " B in " + downloadTime + " ms";
                            break;
                        case amp.bufferDataEventName.downloadfailed:
                            //if (!!bufferData && !!bufferData.downloadFailed) {
                            //    videoBufferDataDisplay += "- download failure: code: " + bufferData.downloadFailed.code + ", message: " + bufferData.downloadFailed.message + "\n";
                            //}
                            msg = "[FAILURE] " + evt.type + ": " + type;
                            break;
                        default:
                            break;
                    }
                    break;  //video
            }

            updateContent();
            events.push(msg);
            updateEvent(EVENTS_TO_DISPLAY);
        }

        //register events to handle for diagnoverlay
        function registerOverlayEvents(){
            var events = [amp.eventName.loadstart,
                          amp.eventName.durationchange,
                          amp.eventName.loadeddata,
                          amp.eventName.loadedmetadata,
                          amp.eventName.canplaythrough,
                          amp.eventName.waiting,
                          amp.eventName.play,
                          amp.eventName.playing,
                          amp.eventName.ended,
                          amp.eventName.seeking,
                          amp.eventName.seeked,
                          amp.eventName.pause,
                          amp.eventName.volumechange,
                          amp.eventName.error,
                          amp.eventName.timeupdate,
                          amp.eventName.playbackbitratechanged,
                          amp.eventName.downloadbitratechanged,
                          amp.eventName.mute,
                          amp.eventName.unmute,
                          amp.eventName.fullscreenchange,
                          amp.eventName.exitfullscreen,
                          amp.eventName.rewind,
                          amp.eventName.resume,
                          amp.eventName.skip,
                          amp.eventName.ratechange,
                          amp.eventName.firstquartile,
                          amp.eventName.midpoint,
                          amp.eventName.thirdquartile,
                         ];

            for (var i = 0; i < events.length; i++) {
                player.addEventListener(events[i], overlayEventHandler);
            }

            //events if framerate plugin is present
            if (!!amp.eventName.framerateready) {
                events = [amp.eventName.framerateready,     
                          amp.eventName.dropframechanged, 
                         ];

                for (var i = 0; i < events.length; i++) {
                    player.addEventListener(events[i], overlayEventHandler);
                }
            }
        }

     
        //****************************************
        //ErrorUtils
        //****************************************
        function ErrorUtils() { };

        ErrorUtils.getErrorObject = function (error) {

            var errorCode, errorMessage, errorSource, errorCategory, detailedErrorCode, detailedErrorDescription;

            var mask_27_00 = 0x0fffffff;                   //  268435455 = 00001111111111111111111111111111   (category level error details)
            var mask_31_28 = 0xF0000000;                   // 4026531840 = 11110000000000000000000000000000   (tech source level error)


            //basic error properties
            if (error.code) {
                errorCode = error.code;
            }

            if (error.message) {
                errorMessage = error.message;
            }

            //error source/tech
            if (error.code) {
                switch (error.code & mask_31_28) {
                    case 0x00000000:
                        errorSource = "Unknow";
                        break;
                    case 0x10000000:
                        errorSource = "AMP";
                        break;
                    case 0x20000000:
                        errorSource = "AzureHtml5JS";
                        break;
                    case 0x30000000:
                        errorSource = "FlashSS";
                        break;
                    case 0x40000000:
                        errorSource = "SilverlightSS";
                        break;
                    case 0x50000000:
                        errorSource = "Html5";
                        break;
                    case 0x60000000:
                        errorSource = "Html5FairPlayHLS";
                        break;
                    default:
                        errorSource = errorCode & 0xF0000000;
                        break;
                }
            }

            //detail level error code and message
            var maskedErrorCode = errorCode & mask_27_00;  //set first 4 bits to 0000   
            var errorCodeRanges = [{ min: amp.errorCode.abortedErrStart, max: 0x01FFFFF, message: "MEDIA_ERR_ABORTED (You aborted the video playback)" },
                                   { min: amp.errorCode.networkErrStart, max: 0x02FFFFF, message: "MEDIA_ERR_NETWORK (A network error caused the video download to fail part-way.)" },
                                   { min: amp.errorCode.decodeErrStart, max: 0x03FFFFF, message: "MEDIA_ERR_DECODE (The video playback was aborted due to a corruption problem or because the video used features your browser did not support.)" },
                                   { min: amp.errorCode.srcErrStart, max: 0x04FFFFF, message: "MEDIA_ERR_SRC_NOT_SUPPORTED (The video could not be loaded, either because the server or network failed or because the format is not supported.)" },
                                   { min: amp.errorCode.encryptErrStart, max: 0x05FFFFF, message: "MEDIA_ERR_ENCRYPTED (The video is encrypted and we do not have the keys to decrypt it.)" },
                                   { min: amp.errorCode.srcPlayerMismatchStart, max: 0x06FFFFF, message: "SRC_PLAYER_MISMATCH (No compatible source was found for this video.)" },
                                   { min: amp.errorCode.errUnknown, max: 0x0, message: "MEDIA_ERR_UNKNOWN (An unknown error occurred.)" },
            ];
            var errorCodes;

            //determine detailed error
            if (maskedErrorCode >= errorCodeRanges[0].min && maskedErrorCode <= errorCodeRanges[0].max) {
                errorCategory = errorCodeRanges[0].message;
                errorCodes = [{ code: amp.errorCode.abortedErrUnknown, description: "Generic abort error" },
                              { code: amp.errorCode.abortedErrNotImplemented, description: "Abort error, not implemented" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[1].min && maskedErrorCode <= errorCodeRanges[1].max) {
                errorCategory = errorCodeRanges[1].message;
                errorCodes = [{ code: amp.errorCode.networkErrUnknown, description: "Generic network error" },
                              { code: amp.errorCode.networkErrHttpResponseBegin, description: "Http error response start value" },
                              { code: amp.errorCode.networkErrHttpBadUrlFormat, description: "Http 400 error response" },
                              { code: amp.errorCode.networkErrHttpUserAuthRequired, description: "Http 401 error response" },
                              { code: amp.errorCode.networkErrHttpUserForbidden, description: "Http 403 error response" },
                              { code: amp.errorCode.networkErrHttpUrlNotFound, description: "Http 404 error response" },
                              { code: amp.errorCode.networkErrHttpNotAllowed, description: "Http 405 error response" },
                              { code: amp.errorCode.networkErrHttpPreconditionFailed, description: "Http 412 error response" },
                              { code: amp.errorCode.networkErrHttpInternalServerFailure, description: "Http 500 error response" },
                              { code: amp.errorCode.networkErrHttpBadGateway, description: "Http 502 error response" },
                              { code: amp.errorCode.networkErrHttpServiceUnavailable, description: "Http 503 error response" },
                              { code: amp.errorCode.networkErrHttpGatewayTimeout, description: "Http 504 error response" },
                              { code: amp.errorCode.networkErrHttpResponseEnd, description: "Http error response end value" },
                              { code: amp.errorCode.networkErrTimeout, description: "Network timeout error" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[2].min && maskedErrorCode <= errorCodeRanges[2].max) {
                errorCategory = errorCodeRanges[2].message;
                errorCodes = [{ code: amp.errorCode.decodeErrUnknown, description: "Generic decode error" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[3].min && maskedErrorCode <= errorCodeRanges[3].max) {
                errorCategory = errorCodeRanges[3].message;
                errorCodes = [{ code: amp.errorCode.srcErrUnknown, description: "Generic source not supported error" },
                              { code: amp.errorCode.srcErrParsePresentation, description: "Presentation parse error" },
                              { code: amp.errorCode.srcErrParseSegment, description: "Segment parse error" },
                              { code: amp.errorCode.srcErrUnsupportedPresentation, description: "Presentation not supported" },
                              { code: amp.errorCode.srcErrInvalidSegment, description: "Invalid segment" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[4].min && maskedErrorCode <= errorCodeRanges[4].max) {
                errorCategory = errorCodeRanges[4].message;                                                                  //5
                errorCodes = [{ code: amp.errorCode.encryptErrUnknown, description: "Generic encrypted error" },
                              { code: amp.errorCode.encryptErrDecrypterNotFound, description: "Decryptor not found" },
                              { code: amp.errorCode.encryptErrDecrypterInit, description: "Decryptor initialization error" },
                              { code: amp.errorCode.encryptErrDecrypterNotSupported, description: "Decryptor not supported" },
                              { code: amp.errorCode.encryptErrKeyAcquire, description: "Key acquire failed" },
                              { code: amp.errorCode.encryptErrDecryption, description: "Decryption of segment failed" },
                              { code: amp.errorCode.encryptErrLicenseAcquire, description: "License acquire failed" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[5].min && maskedErrorCode <= errorCodeRanges[5].max) {
                errorCategory = errorCodeRanges[5].message;                                                                                     //6
                errorCodes = [{ code: amp.errorCode.srcPlayerMismatchUnknown, description: "Generic no matching tech player to play the source" },
                              { code: amp.errorCode.srcPlayerMismatchFlashNotInstalled, description: "Flash plugin is not installed, if installed the source may play. Note: If 0x00600003, both Flash and Silverlight are not installed, if specified in the techOrder." },
                              { code: amp.errorCode.srcPlayerMismatchSilverlightNotInstalled, description: "Silverlight plugin is not installed, if installed the source may play. Note: If 0x00600003, both Flash and Silverlight are not installed, if specified in the techOrder." },
                              { code: 0x00600003, description: "Both Flash and Silverlight are not installed, if specified in the techOrder." },
                ];
            } else {
                errorCategory = errorCodeRanges[6].message;                                                                                                           //0xFF
                errorCodes = [{ code: amp.errorCode.errUnknown, description: "Unknown errors" },
                ];
            }

            //detailed error code and description
            for (var i = 0; i < errorCodes.length; i++) {
                if (maskedErrorCode == errorCodes[i].code) {
                    detailedErrorCode = errorCodes[i].code;
                    detailedErrorDescription = errorCodes[i].description;
                    break;
                }
            }

            //error info container
            var errorObject = {
                code: errorCode,
                message: errorMessage,
                source: errorSource,
                categoryCode: errorCodes[0].code,
                categoryMessage: errorCategory,
                detailedCode: detailedErrorCode,
                detailedDescription: detailedErrorDescription,
            };

            return errorObject;
        }

        ErrorUtils.prettyPrintErrorObject = function (error) {
            //get errorObject container
            var errorObject = ErrorUtils.getErrorObject(error);
            var msg = "Error info:";
            
            msg += "\n- error message: " + errorObject.message;
            msg += "\n- error source: " + errorObject.source;
            if (!!errorObject.code) {
                msg += "\n- error code: " + errorObject.code.toString(16);
            }
            if (!!errorObject.categoryCode) {
                msg += "\n- category code: " + errorObject.categoryCode.toString(16);
            }
            msg += "\n- category message: " + errorObject.categoryMessage;
            if (!!errorObject.detailedCode) {
                msg += "\n- detaild code: " + errorObject.detailedCode.toString(16);
            }
            msg += "\n- detailed description: " + errorObject.detailedDescription;

            return msg;
        }


    });
}(window.amp));
