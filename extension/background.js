// アクティブタブの情報を取得する関数
async function t() {
  return (await chrome.tabs.query({ active: !0, currentWindow: !0 }))[0];
}

chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "runSomething":
      (async function () {
        const tab = await t();
        const allSelect = {
          type: "keyDown",
          windowsVirtualKeyCode: 65,
          modifiers: 4,
        };
        const paste = {
          type: "keyDown",
          key: "v",
          code: "KeyV",
          location: 1,
          windowsVirtualKeyCode: 86,
          modifiers: 4,
        };

        await chrome.debugger.attach({ tabId: tab.id }, "1.3");

        await chrome.debugger.sendCommand(
          { tabId: tab.id },
          "Input.dispatchKeyEvent",
          allSelect
        );
        const code = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return window.getSelection().toString();
          },
        });
        const options2 = {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            text: code[0].result,
          }),
        };
        const formattedCode = await fetch("http://127.0.0.1:4201", options2)
          .then((response) => {
            return response.json();
          })
          .catch((err) => console.error(err));
        // chrome.debugger.sendCommand({ tabId: tab.id }, "Input.insertText", {
        //   text: formattedCode.text,
        // });

        // await chrome.scripting.executeScript({
        //   target: { tabId: tab.id },
        //   func: (code) => {
        //     navigator.clipboard.writeText(code.text);
        //   },
        //   args: [formattedCode],
        // });
        await chrome.debugger.sendCommand(
          { tabId: tab.id },
          "Input.dispatchKeyEvent",
          paste
        );
        await chrome.debugger.detach({ tabId: tab.id });
      })();
      break;
  }
});
