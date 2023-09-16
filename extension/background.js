// アクティブタブの情報を取得する関数
async function t() {
  return (await chrome.tabs.query({ active: !0, currentWindow: !0 }))[0];
}

// 入力するkey情報を設定
const allSelect = {
  type: "keyDown",
  windowsVirtualKeyCode: 65,
  modifiers: 2,
};
const copy = {
  type: "keyDown",
  windowsVirtualKeyCode: 67,
  modifiers: 2,
};
const paste = {
  type: "keyDown",
  windowsVirtualKeyCode: 86,
  modifiers: 2,
};

chrome.commands.onCommand.addListener((command) => {
  if (command == "format") {
    (async function () {
      // アクティブタブの情報を取得
      const tab = await t();

      // colabのサイト以外は以降の処理をスキップ
      if (tab.url.indexOf("https://colab.research.google.com/")) {
        return;
      }

      // デバッガをアタッチ
      await chrome.debugger.attach({ tabId: tab.id }, "1.3");

      // コードを全選択し、クリップボードにコピー
      await chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Input.dispatchKeyEvent",
        allSelect
      );
      await chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Input.dispatchKeyEvent",
        copy
      );

      // クリップボードの内容（コード）を読み取り
      const code = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return navigator.clipboard.readText();
        },
      });

      // フォーマット済のコードをapiから取得
      const options = {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: code[0].result,
        }),
      };
      const formattedCode = await fetch(
        "https://colabformatter-1-l8242131.deta.app/",
        options
      )
        .then((response) => {
          return response.json();
        })
        .catch((err) => console.error(err));

      // フォーマット済のコードをクリップボードに書き込み
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (code) => {
          navigator.clipboard.writeText(code.text.replace(/\s$/, "")); // 最後の改行はnotebookにおいては邪魔なので削除
        },
        args: [formattedCode],
      });

      // クリップボードの内容をペースト
      await chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Input.dispatchKeyEvent",
        paste
      );

      // デバッガをデタッチ
      await chrome.debugger.detach({ tabId: tab.id });
    })();
  }
});
