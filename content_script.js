console.log("Running persistently content_script")

//
// var documentEvents = function() {
//   console.log("DOM load completely, can do our work now")
// }
//
// document.addEventListener("DOMContentLoaded", function() {
//   console.log("dom finished")
// })

var url = document.URL
var pageNavPortName = 'pageNav'
var pageNavPort =  chrome.runtime.connect({name: pageNavPortName})

var saveSearchTerm = function() {
  var search_term = $('#SearchHisTip').text()
  if (search_term != null && search_term.length > 0) {
    console.log("Send search term: " + search_term)
    pageNavPort.postMessage({
      command: "searchterm",
      search_term: search_term,
    })
  }
}


var get_paper_year = function () {
  var iframe = document.getElementById('iframeResult')
  var innerDoc = iframe.contentDocument || iframe.contentWindow.document;
  var tdrighttxts = innerDoc.querySelectorAll('.tdrigtxt')
  var regx = /(\d+)-\d+-\d+/
  var year_set = new Set()
  var year_cnt = {}
  for (var i = 0; i < tdrighttxts.length; i ++) {
    var content = tdrighttxts[i].textContent
    var match = regx.exec(content)
    if (match != null) {
      year = parseInt(match[1])
      if (year in year_cnt)
        year_cnt[year] ++
      else
        year_cnt[year] = 1

    }
  }

  // find top year
  console.log("Year cnt is: ", year_cnt)

  var major_year_cnt = -1
  var major_year = -1
  for (key in year_cnt) {
    if (year_cnt[key] > major_year_cnt) {
      major_year = key
      major_year_cnt = year_cnt[key]
    }
  }
  return major_year
}


// close if it's in dissertation page
setTimeout(function() {
  var whole = document.getElementsByClassName('whole')
  var chapter = document.getElementsByClassName('chapter')

  if (whole.length > 0 && chapter.length > 0) {
    console.log("Close on dissertation page")
    var portName = "downloadurl"
    var port = chrome.runtime.connect({name: portName})
    port.postMessage({command: "close"})
  }
}, 3000)


if (url.indexOf("download.aspx") != -1 ||
    url.indexOf('www.cnki.net/KCMS/detail/') !== -1) {
  // close the page if it hasn't been closed in 90 seconds
  var closeWindoTimeout = setTimeout(function() {
    console.log("Close too long lived page")
    var portName = "downloadurl"
    var port = chrome.runtime.connect({name: portName})
    port.postMessage({command: "close"})
  }, 90000)
}


if (url.indexOf("ecppdown.cnki.net/cjfdsearch/pdfdownloadnew.asp") != -1) {
  var portName = "downloadurl"
  var port = chrome.runtime.connect({name: portName})

  // close this page after 4 seconds
  setTimeout(function () {
    port.postMessage({command: "close"})
  }, 4000)
}


var disablerFunction = function () {
    window.alert = function alert(msg) { console.log('Hidden Alert ' + msg); };
    window.confirm = function confirm(msg) {
        console.log("Hidden Confirm " + msg);
        return true; /*simulates user clicking yes*/
    };

};

setInterval(function(){
  var disablerCode = "(" + disablerFunction.toString() + ")();";
  var disablerScriptElement = document.createElement('script');
  disablerScriptElement.textContent = disablerCode;

  document.documentElement.appendChild(disablerScriptElement);
  disablerScriptElement.parentNode.removeChild(disablerScriptElement);
}, 500)


if (url.indexOf('www.cnki.net/KCMS/detail/') !== -1) {
  console.log("In pdf page, prepare to download")

  var pdfdownloadlink = null
  var portName = "downloadurl"
  var port = chrome.runtime.connect({name: portName})
  var queryTimes = 0
  var checkIfDownloaded = null

  var queryPDFDownloaded = function() {
    if (pdfdownloadlink == null) {
      return
    }
    url = pdfdownloadlink.href
    console.log("Sending url query to extension:"  + url)
    port.postMessage({
      command: "query",
      url: url,
    })
    queryTimes ++
    if (queryTimes > 2) {
      // do not try too many times
      clearInterval(checkIfDownloaded)
    }
  }



  var checkLinkExist = setInterval(function() {
    pdfdownloadlink = document.querySelector('li.pdf a')
    if (pdfdownloadlink == null) {
      console.log("Didn't find pdf link, wait for next trial")
      return
    }
    console.log("found pdf download link: " + pdfdownloadlink.href)
    clearInterval(checkLinkExist)

    // checking if pdf has been downloaded
    queryPDFDownloaded()
    checkIfDownloaded = setInterval(queryPDFDownloaded, 10000)
  }, 5000)



  // port is downloadURL port
  port.onMessage.addListener(function(msg) {
    // console.log("Receive response from extension: " + JSON.stringify(msg))
    if (msg.downloaded == true) {
      console.log("the url has been downloaded")
      clearInterval(checkIfDownloaded)

      // close port
      console.log("post close message")
      port.postMessage({
        command: "close"
      })
    } else {
      console.log("the url hasn't been downloaded, try downloading")
      pdfdownloadlink.click()
    }
  })
}


var paper_links = []
var paper_types = []
var click_idx = 0

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log('receive request: ' + JSON.stringify(request))
    var command = request.command
    var name = request.name
    var inst = request.inst

    if (command == "fill") {
      console.log("do fill")
      console.log("Change institution to " + inst)
      document.getElementById('txt_1_sel').selectedIndex=4
      document.getElementById('txt_1_value1').value = inst
      document.getElementById('btnSearch').click()

      if (name != null && name != "") {
        var wait = setInterval(function() {
          var i = document.getElementById('txt_1_sel')
          if (i == null) {
            return
          }

          console.log('Change name to: ' + name)
          i.selectedIndex=3
          document.getElementById("txt_1_value1").value=name
          document.getElementById('divresult').click()
          clearInterval(wait)
        }, 2000)
      }

    } else if (command == 'search') {
      // search
      var field = request.field
      var keyword = request.keyword
      var type = request.type
      var found = -1
      var e = document.getElementById('txt_1_sel')
      for (var index = 0; index < 10; index ++ ) {
        var optionValue = e.options[index].textContent
        if (optionValue === field) {
          console.log("Found field " + field + " at index: " + index)
          found = index
          break
        }
      }
      if (found === -1) {
        prompt('Cannot find field: ' + field)
      } else {
        document.getElementById('txt_1_sel').selectedIndex = found
        document.getElementById('txt_1_value1').value = keyword

        if (type === 'new_search') {
          document.getElementById('btnSearch').click()
        } else {
          // search in results
          document.getElementById('divresult').click()
        }

        setTimeout(saveSearchTerm(), 1000)
    } // end found == -1

    } else if (command == "click") {
      saveSearchTerm()

      var year = request.year
      console.log("Receive click command and year is: " + year)

      // get page
      var paper_year = get_paper_year()

      console.log("main paper year: " + paper_year)
      if (year != '*' && paper_year != year) {
        prompt("main paper year " +  paper_year + ' does not eqaul download year: ' + year)
        return
      }

      console.log("Good, main paper year " +  paper_year + ' eqauls download year: ' + year + " keep clicking links")


      var iframe = document.getElementById('iframeResult')
      var innerDoc = iframe.contentDocument || iframe.contentWindow.document;

      paper_links = innerDoc.querySelectorAll(".fz14")
      paper_types = []

      var paper_type_fields = innerDoc.querySelectorAll('#ctl00 > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td:nth-child(6)')
      if (paper_type_fields.length == 51) {
          for (var i = 1; i < 51; i ++) {
            paper_types.push($.trim(paper_type_fields[i].textContent))
          }
          console.log("found paper type: " + paper_types)
      }


      click_idx = 0
      console.log("Receiving click command, found " + paper_links.length + " links click_idx: " + click_idx )
    } else if (command == "clear") {
      chrome.downloads.erase({}, function(res){console.log("erased: " + res.length)})
    } else if (command == "goto") {
      // goto command, needs to make sure it's the right year
      var goto_page_no = request.pageno
      var year = request.year
      console.log("Recived goto command, goto page: " + goto_page_no + " year: " + year)

      // switch to group by year
      var year_links = document.getElementById('group').querySelectorAll('span a')
      for (var i = 0; i < year_links.length; i ++) {
        if (year_links[i].textContent == year) {
          console.log("Found and click year link: " + year + year_links[i])
          year_links[i].click()
        }
      }



      // wait 10 seconds and go to page
      setTimeout(function() {
        console.log("Now going to page: " + goto_page_no)
        var iframe = document.getElementById('iframeResult')
        var innerDoc = iframe.contentDocument || iframe.contentWindow.document;
        var titleLeftCells = innerDoc.getElementsByClassName('TitleLeftCell')
        if (titleLeftCells == null || titleLeftCells.length == 0) {
          console.log("Cannot find titleLeftCells")
          return
        }

        var a = titleLeftCells[0].querySelectorAll('a')[0]
        var href = a.href
        a.href = href.replace(/curpage=(\d+)/, 'curpage=' + goto_page_no)
        a.click()
      }, 10000) // end setTimeout
    } // end command == "goto"
  });



var getCurrentPage = function() {
  var iframe = document.getElementById('iframeResult')
  var innerDoc = iframe.contentDocument || iframe.contentWindow.document;
  var titleLeftCells = innerDoc.getElementsByClassName('TitleLeftCell')
  if (titleLeftCells == null || titleLeftCells.length == 0) {
    console.log("Cannot find titleLeftCells")
    return -1
  }
  titleLeftCell = titleLeftCells[0]
  marks = titleLeftCell.getElementsByClassName('Mark')
  if (marks == null || marks.length == 0) {
    console.log("Cannot find the marks")
    return -1
  }

  currentPage = parseInt(marks[0].textContent)
  if (currentPage == null) {
    console.log ('Cannot find current page')
    return -1
  }
  return currentPage
}




// try to click link one by one
var click_paper = setInterval(function() {
  if (paper_links.length == 0) {
    console.log("no paper links, skip")
    return
  } else if (click_idx >= paper_links.length) {
 //} else if (click_idx >= 2) {
    var curPage = getCurrentPage()
    console.log("finished click everything stop, send curPage to plugin: " + curPage)
    click_idx = 0
    paper_links = []
    paper_types = []
    // send finish signal to background
    pageNavPort.postMessage({
      command: "finish",
      page_no: curPage
    })

    return
  }


  while (click_idx < paper_links.length) {
    var link = paper_links[click_idx]
    var skip = false
    if (paper_types.length == paper_links.length) {
      if (paper_types[click_idx] === '硕士' || paper_types[click_idx] === '博士') {
        console.log(click_idx+1 + "th paper type is: " + paper_types[click_idx] + " skip")
        skip = true
      }
    }

    click_idx ++
    if (!skip) {
        console.log("Click " + click_idx + " link")
        link.click()
        break
    }
  }


}, 18000)




// send message to query if the url has been downloaded
//var url = "http://www.cnki.net/kcms/download.aspx?filename=UMN5URtVTULFjUwBFa5kVVwEEc5dEbrJXdWZTeyd0TvYWdFJDaldGajJHWoR2SpRHTyhXWjplTjhVT=0TUEt0MwhVRmhkUZFTVGJFSvMXOsNUe59ENSNGNDxkcPFkQ6NWahNzLQZkav9mbxsES3Ale2lFT1I&tablename=CJFDLAST2015&dflag=pdfdown"
