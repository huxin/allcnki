// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// try to listen on navigation event to prevent alert dialogue

var disablerFunction =  "window.alert = function alert(msg) { console.log('Hidden Alert ' + msg); };\n" +
                       "window.confirm = function confirm(msg) {" +
                       "console.log('Hidden Confirm ' + msg);" +
                       "return true; /*simulates user clicking yes*/" +
                       "};"


var eventList = ['onBeforeNavigate', 'onCreatedNavigationTarget',
   'onCommitted', 'onCompleted', 'onDOMContentLoaded',
   'onErrorOccurred', 'onReferenceFragmentUpdated', 'onTabReplaced',
   'onHistoryStateUpdated'];

eventList.forEach(function(e){
  chrome.webNavigation[e].addListener(function(data){
    if (data.tabId) {
      console.log("Inject disable code to tab id: " + data.tabId + e)
      chrome.tabs.executeScript(data.tabId, {
        code: disablerFunction
      })
    }
  })

})




// Called when the user clicks on the browser action icon.
var downloadedURLs = {}
var updateDownloaded = function () {
    console.log("Downloaded URL: " + Object.keys(downloadedURLs).length)
    chrome.downloads.search({}, function (results) {
    var found = null
    for (var i = 0; i < results.length; i ++) {
      downloadedURLs[results[i].url] = 1
    }
  })
}
setInterval(updateDownloaded, 3000);

var downloadURLPortName = "downloadurl"

var year = -1
var page_from = -1
var page_to = -1
var page_to_click = -1
var search_res_page = -1
var pageNavPortName = 'pageNav'

var goto_and_start_click = function(tab_id, page_num){
  // send a goto message and then send a click
  console.log("Sending goto command to page:" + page_num)
  chrome.tabs.sendMessage(search_res_page, {
    command: "goto",
    pageno: page_num,
    year: year,
  })

  // use chrome.tabs to find if we have successfully go to the page
  // TODO:

  // then should send a click events
  setTimeout(function(){
    console.log("sending click command")
    chrome.tabs.sendMessage(search_res_page, {
      command: "click",
      year: year,
    })
  }, 15000) // wait 5 seconds until next
}

var pageNavListener = function(msg, sendingPort) {
    // communicate with popup.js to get page information
    console.log("receive message for pageNav: " + JSON.stringify(msg) )

    if (msg.command == "start") {
      year = msg.year
      page_from = msg.page_from
      page_to = msg.page_to
      page_to_click = msg.page_from
      search_res_page = msg.tab_id

      chrome.storage.local.set({
        'progress': page_to_click,
        'start': page_from,
        'end': page_to,
        'year': year
      })


      goto_and_start_click(search_res_page, page_to_click)
    } else if (msg.command == "finish") {
      console.log("Finished " + msg.page_no)
      // page_to_click = parseInt(msg.page_no) + 1
      page_to_click += 1
      chrome.storage.local.set({
        'progress': page_to_click,
        'start': page_from,
        'end': page_to,
        'year': year
      })

      if (page_to_click >= page_from && page_to_click <= page_to) {
        goto_and_start_click(search_res_page, page_to_click)
      } else {
        console.log("page to click " + page_to_click + " is outside [" + page_from, + ", " + page_to + "], stop clicking")
      }

    } else if (msg.command == "requestStatusUpdate") {
      // send back current page information
      if (page_to_click == -1) {

        chrome.storage.local.get({'progress': -2, "year": -3}, function (r2) {
          sendingPort.postMessage({
            command: "updateStatus",
            status: "dl: " + r2.progress + ' yr: ' + r2.year
          })
        })
      } else {
        sendingPort.postMessage({
          command: "updateStatus",
          status: "dl: " + page_to_click + ' yr: ' + year
        })
      }

    }

}

// listen on a port waiting for queries
chrome.runtime.onConnect.addListener(function(port) {

  if (port.name == downloadURLPortName) {
    console.log("Receive downloadURLPort")
    port.onMessage.addListener(function(msg, sendingPort) {
          console.log("receive message: " + JSON.stringify(msg))
          var command = msg.command
          if (command == "query") {
            var u = msg.url
            console.log("receive msg for query url: " + u)
            port.postMessage({"downloaded": downloadedURLs[u] != null})
          } else if (command == "close") {
            var tabid = sendingPort.sender.tab.id
            console.log("receive msg for close tab: " + tabid)
            chrome.tabs.remove(tabid)
          }
    })
  } else if (port.name = pageNavPortName) {
    console.log("Receive page nav port")
    port.onMessage.addListener(pageNavListener)
  }

})



setInterval(function() {
  // clearn up tabs that are errors
  chrome.tabs.query({}, function(res){

    var close_tabs = []
    for (var i = 0; i < res.length; i ++) {
      var url = res[i].url

      if (url.indexOf("ecppdown.cnki.net/cjfdsearch/pdfdownloadnew.asp") != -1) {
        close_tabs.push(res[i].id)
      }
    }

    console.log("found: " + res.length + " tabs ", close_tabs.length, " to close")
    setTimeout(function() {
      console.log("Close tabs:"  +close_tabs.length)
      for (var j=0; j < close_tabs.length; j ++) {
        chrome.tabs.remove(close_tabs[j])
      }
      close_tabs = []
    }, 3000)
  })


}, 10000)
