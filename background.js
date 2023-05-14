
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "makeRequest") {
    fetch(request.url)
      .then((response) => response.json())
      .then((data) => {
        sendResponse({ data: data });
      })
      .catch((error) => {
        sendResponse({ error: error });
      });
  }
  if (request.action === "getShowThreshold") {
    chrome.storage.sync.get(["checkbox1", "threshold1"], function (data) {
      sendResponse({ data: data });
    })
  }
  return true;
});
