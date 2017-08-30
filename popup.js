// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// use storage, after click one, remove from storage and when there is nothing in
// the storage, do nothing

// var url = "http://60.191.152.123:85/zk/search.aspx?key=A=杨洁[*]S=安徽医科大学"
// chrome.tabs.create({url: url})


document.addEventListener("DOMContentLoaded", documentEvents, false)


function documentEvents() {
  document.getElementById('ok_btn').addEventListener('click', function(){
      // read names
      var name = document.getElementById("name").value
      document.getElementById('status').textContent = name

      inst = "安徽医科大学"
      if (document.getElementById('ahmu').checked) {
        inst = "安徽医科大学"
      }

      if (document.getElementById('jfj').checked) {
        inst = "解放军"
      }

      // send data to the content_script for filling the search information
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          console.log("send to active tab: " + name + " " + inst);
          chrome.tabs.sendMessage(tabs[0].id, {
            command: "fill",
            name: name,
            inst: inst})
      });
  }) // end ok_btn


  document.getElementById('click_btn').addEventListener('click', function(){
    document.getElementById('status').textContent = "start clicking"
    // send data to the content_script for filling the search information
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        console.log("send click command to active tab");
        var year = parseInt(document.getElementById("year").value)
        chrome.tabs.sendMessage(tabs[0].id, {command: "click", year: year})
    });
  }) // end click_btn


  var pageNavPortName = 'pageNav'
  var pageNavPort = chrome.runtime.connect({name: pageNavPortName})

  pageNavPort.onMessage.addListener(function(msg, sendingPort) {
    console.log("pageNavePort receive msg: " + JSON.stringify(msg))
    if (msg.command == "updateStatus") {
      document.getElementById('status').textContent = msg.status
    }

  })

  // every second tries to update the results
  setInterval(function() {
    pageNavPort.postMessage({
      command: 'requestStatusUpdate'
    })
  }, 1000)

  document.getElementById('pg_btn').addEventListener('click', function() {
    var year_str = document.getElementById("year").value
    var year
    if (year_str == '*') {
      year = '*'
    } else {
      year = parseInt(year_str)
    }

    var page_from = parseInt(document.getElementById("pagefrom").value)
    var page_to = parseInt(document.getElementById("pageto").value)

    if (isNaN(page_from) || isNaN(page_to)) {
      document.getElementById('status').textContent = "Invalid Page/year Number"
      return
    }

    document.getElementById('status').textContent = "year: " + year + " from " + page_from + " to " + page_to

    // find active chrome tab and send it over to pageNav with data
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var tab_id = tabs[0].id
        console.log("find active tab: " + tab_id);
        pageNavPort.postMessage({
          command: "start",
          year: year,
          page_from: page_from,
          page_to: page_to,
          tab_id: tab_id
        })


    });



    // send a message to content_script to navigate to desired pages
    // chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    //     console.log("send page number to active tab");
    //     chrome.tabs.sendMessage(tabs[0].id, {command: "goto", pageno: page_from})
    // });



  }) // end pg_btn
}
