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

//****************************************
//willzhan@microsoft.com, 2/2018, Commercial Software Engineering
//****************************************

(function (mediaPlayer) {
    "use strict";

    mediaPlayer.plugin('diagnoverlay', function (options) {

        //****************************************
        // INPUTS & VARIABLES
        //****************************************

        //plugin level variables
        var stopEventUpdate = false;   //indate whether to stop event update in updateEvent such as when error occurs
        var events = [];               //holding all events
        var EVENTS_TO_DISPLAY = 10000;
        var timeupdateDisplay = "", streamDisplay = "", audioBufferDataDisplay = "", videoBufferDataDisplay = "", framerate = "";
        var player = this, overlayCssClass = "amp-diagnoverlay";

        //input parameters
        var title = !!options && !!options.title ? options.title : "",
            opacity = !!options && !!options.opacity ? options.opacity : 0.6,
            bgColor = !!options && !!options.bgColor ? options.bgColor : "Black",
            x = !!options && !!options.x ? options.x : "left",
            y = !!options && !!options.y ? options.y : "top";


       
        //****************************************
        // PLUGIN
        //****************************************


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

            ////event checkbox
            //var checkbox = document.createElement('input');
            //checkbox.type = "checkbox";
            //checkbox.name = "chkbox";
            //checkbox.value = "value";
            //checkbox.id = "chkevent";
            //checkbox.onclick = function () {
            //    if (this.checked) {
            //        player.overlay.eventdiv.style.visibility = "visible";
            //        player.overlay.eventdiv.style.display = "block";
            //        stopEventUpdate = false;
            //    } else {
            //        player.overlay.eventdiv.style.visibility = "hidden";
            //        player.overlay.eventdiv.style.display = "none";
            //        stopEventUpdate = true;
            //    }
            //}

            //var label = document.createElement('label')
            //label.htmlFor = "chkevent";
            //label.appendChild(document.createTextNode("show events or errors"));
            //overlay.container.appendChild(checkbox);
            //overlay.container.appendChild(label);

            //select
            var select = document.createElement("select");
            select.name = "select";
            select.id = "select";
            var dropdowns = ["select", "show events or errors", "show DRM protection"];  //options variable is taken
            var dropdown;
            for (var i = 0; i < dropdowns.length; i++) {
                dropdown = document.createElement("option");
                dropdown.innerHTML = dropdowns[i];
                dropdown.value = dropdowns[i];
                select.appendChild(dropdown)
            }
            select.onchange = function () {
                //initial visibility status
                stopEventUpdate = true;
                player.overlay.pre.textContent = "";
                player.overlay.pre.style.display = "none";
                player.overlay.eventdiv.style.visibility = "visible";
                player.overlay.eventdiv.style.display = "block";
                player.overlay.eventdiv.innerHTML = "";

                switch (select.options[select.selectedIndex].value) {
                    case dropdowns[0]:
                        //hide eventdiv
                        player.overlay.eventdiv.style.visibility = "hidden";
                        player.overlay.eventdiv.style.display = "none";                
                        break;
                    case dropdowns[1]:
                        //start displaying events
                        stopEventUpdate = false;
                        updateEvent(EVENTS_TO_DISPLAY);
                        break;
                    case dropdowns[2]:
                        //display DRM info
                        getProtectionInfo();
                        break;
                    default:
                        break;
                }
            } //onchange
            overlay.container.appendChild(select);

            //event div
            var eventdiv = videojs.createEl("div", {});
            eventdiv.id = "eventdiv";
            eventdiv.style.visibility = "hidden";
            eventdiv.style.display = "none";
            eventdiv.onload = function () {
                updateOverlay();
            };
            overlay.container.appendChild(eventdiv);

            //pre
            var pre = document.createElement("pre");
            pre.textContent = "";
            pre.style.display = "none";
            overlay.container.appendChild(pre);

            //expose div and eventdiv
            overlay.div = div;
            overlay.eventdiv = eventdiv;
            overlay.pre = pre;
            overlay.select = select;
        }

        player.ready(function () {  //main function
            var overlay = new mediaPlayer.Overlay(player);
            player.overlay = player.addChild(overlay);
            registerOverlayEvents();

            events.push("player.ready event");
        });



        //****************************************
        // FORMATTING
        //****************************************

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

        

        //****************************************
        //  POSITION & SIZE
        //****************************************


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

        

        //****************************************
        // UPDATE CONTENT
        //****************************************


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


        
        //****************************************
        // DRM
        //****************************************

        //get smooth URL
        function getSmoothUrl() {  
            var url = player.currentSrc();
            url = url.substr(0, url.toLowerCase().indexOf("/manifest") + 9);
            return url;
        }

        function getDashUrl() {
            var url = getSmoothUrl() + "(format=mpd-time-csf)";
            return url;
        }

        //credit: http://dean.edwards.name/weblog/2009/12/getelementsbytagname/ This works in all major browsers
        function getElementsByTagNameCustom(node, tagName) {
            var elements = [], i = 0, anyTag = tagName === "*", next = node.firstChild;
            while ((node = next)) {
                if (anyTag ? node.nodeType === 1 : node.nodeName === tagName) elements[i++] = node;
                next = node.firstChild || node.nextSibling;
                while (!next && (node = node.parentNode)) next = node.nextSibling;
            }
            return elements;
        }

        //decode base64 binary and display in <div id="info">
        function decodeBase64(base64Data, msg) {
            var a = Base64Binary.decode(base64Data), h = new Blob([a]), f = new FileReader;
            f.onload = function (a) {
                a = "ascii";
                f.onload = function (a) {
                    //put protection header in pre
                    var protectionHeader = a.target.result.replace(/[^\x20-\x7E]/g, '');
                    player.overlay.pre.textContent = protectionHeader;
                    player.overlay.pre.style.display = "block";

                    var laurl = extractFromProtectionHeader(protectionHeader, "LA_URL");
                    player.overlay.eventdiv.innerText += "\nPlayReady LA_URL: " + laurl +
                                                         "\nmspr:pro: ";
                }, f.readAsText(h, a);
            };
            f.readAsArrayBuffer(h);
        }

        function extractFromProtectionHeader(protectionHeader, node) {
            var start = "<" + node + ">";
            var end = "</" + node + ">";
            var startIndex = protectionHeader.indexOf(start) + 2 + node.length;
            var endIndex = protectionHeader.indexOf(end);

            return protectionHeader.substring(startIndex, endIndex);
        }

        //credit goes to: http://base64online.org/decode/ for Base64Binary
        var Base64Binary = {
            _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

            /* will return a  Uint8Array type */
            decodeArrayBuffer: function (input) {
                var bytes = (input.length / 4) * 3;
                var ab = new ArrayBuffer(bytes);
                this.decode(input, ab);

                return ab;
            },

            decode: function (input, arrayBuffer) {
                //get last chars to see if are valid
                var lkey1 = this._keyStr.indexOf(input.charAt(input.length - 1));
                var lkey2 = this._keyStr.indexOf(input.charAt(input.length - 2));

                var bytes = (input.length / 4) * 3;
                if (lkey1 == 64) bytes--; //padding chars, so skip
                if (lkey2 == 64) bytes--; //padding chars, so skip

                var uarray;
                var chr1, chr2, chr3;
                var enc1, enc2, enc3, enc4;
                var i = 0;
                var j = 0;

                if (arrayBuffer)
                    uarray = new Uint8Array(arrayBuffer);
                else
                    uarray = new Uint8Array(bytes);

                input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

                for (i = 0; i < bytes; i += 3) {
                    //get the 3 octects in 4 ascii chars
                    enc1 = this._keyStr.indexOf(input.charAt(j++));
                    enc2 = this._keyStr.indexOf(input.charAt(j++));
                    enc3 = this._keyStr.indexOf(input.charAt(j++));
                    enc4 = this._keyStr.indexOf(input.charAt(j++));

                    chr1 = (enc1 << 2) | (enc2 >> 4);
                    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                    chr3 = ((enc3 & 3) << 6) | enc4;

                    uarray[i] = chr1;
                    if (enc3 != 64) uarray[i + 1] = chr2;
                    if (enc4 != 64) uarray[i + 2] = chr3;
                }

                return uarray;
            },

            encode: function base64ArrayBuffer(arrayBuffer) {
                var base64 = ''
                var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

                var bytes = new Uint8Array(arrayBuffer)
                var byteLength = bytes.byteLength
                var byteRemainder = byteLength % 3
                var mainLength = byteLength - byteRemainder

                var a, b, c, d
                var chunk

                // Main loop deals with bytes in chunks of 3
                for (var i = 0; i < mainLength; i = i + 3) {
                    // Combine the three bytes into a single integer
                    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

                    // Use bitmasks to extract 6-bit segments from the triplet
                    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
                    b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
                    c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
                    d = chunk & 63               // 63       = 2^6 - 1

                    // Convert the raw binary segments to the appropriate ASCII encoding
                    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
                }

                // Deal with the remaining bytes and padding
                if (byteRemainder == 1) {
                    chunk = bytes[mainLength]

                    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

                    // Set the 4 least significant bits to zero
                    b = (chunk & 3) << 4 // 3   = 2^2 - 1

                    base64 += encodings[a] + encodings[b] + '=='
                } else if (byteRemainder == 2) {
                    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

                    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
                    b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4

                    // Set the 2 least significant bits to zero
                    c = (chunk & 15) << 2 // 15    = 2^4 - 1

                    base64 += encodings[a] + encodings[b] + encodings[c] + '='
                }

                return base64
            }
        }  //Base64Binary

        function getProtectionInfo() {
            var msg = "", url;

            //DASH
            url = getDashUrl();
            BrowserUtils.xhrRequest(url, "GET", "", "", "useResponseXML", function (xml) {
                if (!!xml) {
                    //CENC
                    var cencElements = xml.getElementsByTagName("ContentProtection");
                    if (cencElements != undefined && cencElements.length > 0) {
                        for (var j = 0; j < cencElements.length; j++) {
                            msg += "\n" + cencElements[j].parentNode.getAttribute("mimeType") + "/" +
                                          cencElements[j].parentNode.getAttribute("codecs") + "/" +
                                          cencElements[j].parentNode.getAttribute("contentType") + ": " +
                                   "\n - cenc:default_KID: " + cencElements[j].getAttribute("cenc:default_KID") +
                                   "\n - schemeIdUri: " + cencElements[j].getAttribute("schemeIdUri");
                            if (!!cencElements[j] && !!cencElements[j].getAttribute("value")) {
                                msg += "\n - value: " + cencElements[j].getAttribute("value");
                            }
                        }
                    } else {
                        msg += "ContentProtection not found.";
                    }

                    var protectionHeaderElements;
                    //DASH Widevine
                    protectionHeaderElements = getElementsByTagNameCustom(xml, "ms:laurl");
                    if (!!protectionHeaderElements && protectionHeaderElements.length > 0) {
                        msg += "\n\nWidevine LA_URL: " + protectionHeaderElements[0].getAttribute("licenseUrl");
                    } else {
                        msg += "\nWidevine ms:laurl not found.";
                    }

                    //DASH PlayReady
                    //var protectionHeaderElements = xml.getElementsByTagName("mspr:pro");  //this does not work in Edge or Chrome 
                    protectionHeaderElements = getElementsByTagNameCustom(xml, "mspr:pro");
                    if (!!protectionHeaderElements && protectionHeaderElements.length > 0) {
                        decodeBase64(protectionHeaderElements[0].childNodes[0].nodeValue, msg);
                    } else {
                        msg += "\nPlayReady mspr:pro not found."
                    }
                } else {
                    msg += "Check the DASH URL: " + url;
                }

                player.overlay.eventdiv.innerText += msg.length > 0? msg : "\nDASH is not DRM protected";
            });

            //Smooth
            //url = getSmoothUrl();
            ////for DASH+CENC case, smooth is not allowed (403)
            //try {
            //    BrowserUtils.xhrRequest(url, "GET", "", "", "useResponseXML", function (xml) {
            //        //Smooth - PlayReady protection
            //        if (!!xml) {
            //            var protectionHeaderElements = xml.getElementsByTagName("ProtectionHeader");
            //            if (!!protectionHeaderElements && protectionHeaderElements.length > 0) {
            //                for (var i = 0; i < protectionHeaderElements.length; i++) {
            //                    msg = "\nSmooth Streaming mspr:pro:";
            //                    decodeBase64(protectionHeaderElements[i].childNodes[0].nodeValue, msg);
            //                }
            //            } else {
            //                player.overlay.eventdiv.innerText += "\nSmooth stream protection header is not found."
            //            }
            //        } else {
            //            player.overlay.eventdiv.innerText += "\nSmooth streaming is not allowed."
            //        }

            //        //Smooth - AES encryption
            //    });
            //}
            //catch (e) {
            //    player.overlay.eventdiv.innerText += "\n" + e.message;
            //}

        }  //getProtectionInfo




        //****************************************
        // BROWSER UTILS
        //****************************************

        function BrowserUtils() { };

        //Utility function for making XMLHttpRequest
        //httpMethod: GET, or POST
        //responseType: arraybuffer, "" (default: text), blob, stream
        //msCaching: auto, enabled, disabled
        BrowserUtils.xhrRequest = function (url, httpMethod, responseType, msCaching, context, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open(httpMethod, url);
            xhr.responseType = responseType;
            xhr.msCaching = msCaching;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        if (context == "useResponseXML") {        //MPD request
                            callback(xhr.responseXML, context);
                        }
                        else {                                    //fragment/LA request
                            callback(xhr.response, context);
                        }
                    } else {
                        console.log("XHR: failed. URL = " + url + ". Status = " + xhr.status + ". " + xhr.statusText);
                        callback(null, context);
                    }
                }
            }
            xhr.send();
            console.log("XHR: method=" + httpMethod + ", ResponseType=" + responseType + ", URL=" + url);

            return xhr;
        }

        //create <table> with given matrix and id
        BrowserUtils.createTable = function (matrix, id) {
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



        //****************************************
        // EVENTS
        //****************************************

        function overlayEventHandler(evt) {

            //event update
            if (evt.type != amp.eventName.timeupdate) {
                events.push(evt.type);
                updateEvent(EVENTS_TO_DISPLAY);
            }

            switch (evt.type) {
                case amp.eventName.loadedmetadata:
                    //register buffer data events
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

                    //register stream events
                    registerStreamEvents();

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
                    updateEvent(EVENTS_TO_DISPLAY);
                    stopEventUpdate = true;  //some browsers will not stop on error
                    break;
                default:
                    break;
            }
        }

        function registerStreamEvents() {
            //trackselected events
            var videoStreamList = player.currentVideoStreamList();
            if (!!videoStreamList && videoStreamList.streams.length > 0) {
                videoStreamList.streams[0].addEventListener(amp.streamEventName.trackselected, trackselectedHandler);
            }
        }

        //manually selected/forced bitrate, different from amp.eventName.playbackbitratechanged
        function trackselectedHandler(evt) {
            var msg = evt.type + ": selected bitrate " + player.currentPlaybackBitrate();
            events.push(msg);
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
            var url;
            
            switch (type) {
                case "audio":
                    bufferData = player.audioBufferData();
                    switch (evt.type) {
                        case amp.bufferDataEventName.downloadrequested:
                            url = bufferData.downloadRequested.url;
                            if (url.indexOf("mediaservices.windows.net") > 0) {  //AMS source
                                url = " ... " + url.substr(url.indexOf(".net/") + 41);
                            }
                            msg = evt.type + ": " + url;
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
                            url = bufferData.downloadRequested.url;
                            if (url.indexOf("mediaservices.windows.net") > 0) {  //AMS source
                                url = " ... " + url.substr(url.indexOf(".net/") + 41);
                            }
                            msg = evt.type + ": " + url;
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
