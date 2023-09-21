// アクティブタブの情報を取得する関数
async function t() {
  return (await chrome.tabs.query({ active: !0, currentWindow: !0 }))[0];
}

// OSの判別
let os = "";
chrome.runtime.getPlatformInfo(function (info) {
  os = info.os;
});

chrome.commands.onCommand.addListener((command) => {
  if (command == "format") {
    (async function () {
      // アクティブタブの情報を取得
      const tab = await t();

      // colabのサイト以外は以降の処理をスキップ
      if (tab.url.indexOf("https://colab.research.google.com/")) {
        return;
      }

      //OSによって修飾キーを変える
      const ctrl = 2;
      const command = 4;
      let modifiers = os == "mac" ? command : ctrl;

      // 入力するkey情報を設定
      const allSelect = {
        type: "keyDown",
        windowsVirtualKeyCode: 65,
        modifiers: modifiers,
      };
      const paste = {
        type: "keyDown",
        windowsVirtualKeyCode: 86,
        modifiers: 2,
      };
      const deleteKey = {
        type: "keyDown",
        windowsVirtualKeyCode: 8,
      };
      const selectIndent = {
        type: "keyDown",
        windowsVirtualKeyCode: 36,
        modifiers: 8,
      };

      // デバッガをアタッチ
      await chrome.debugger.attach({ tabId: tab.id }, "1.3");

      // コードを全選択
      await chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Input.dispatchKeyEvent",
        allSelect
      );

      // フォーマット前のコードを取得
      const code = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const code = [
            ...document.querySelectorAll(".cell.code.focused .view-line"),
          ];
          let combinedCode = "";

          code.sort(function (first, second) {
            firstStyleTop = Number(first.style.top.replace("px", ""));
            secondStyleTop = Number(second.style.top.replace("px", ""));
            return firstStyleTop - secondStyleTop;
          });

          code.forEach((line) => {
            const lineChildren = [...line.children[0].children];
            let combinedLine = "";
            lineChildren.forEach((child) => {
              combinedLine += child.textContent;
            });
            combinedCode += combinedLine + "\n";
          });
          return combinedCode;
        },
      });

      // フォーマット済みのコードをapiから取得
      const options = {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: code[0].result.replace(/\xA0/g, " "), // ノーブレークスペースがあるとフォーマットが正しくできないので通常の半角スペースに変換する
        }),
      };
      let formattedCode = await fetch(
        "https://colabformatter-1-l8242131.deta.app/",
        options
      )
        .then((response) => {
          return response.json();
        })
        .catch((err) => console.error(err));

      // 最後の改行はnotebookにおいては邪魔なので削除
      formattedCode = formattedCode.text.replace(/\n$/, "");
      console.log(formattedCode);
      if (os == "mac") {
        // フォーマット前のコードをクリップボードに書き込み
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (code) => {
            navigator.clipboard.writeText(code);
          },
          args: [code[0].result.replace(/\xA0/g, " ")],
        });

        //　コードを改行で分割
        let splitCode = formattedCode.split(/(?<=\r\n|\n)/);

        await chrome.debugger.sendCommand(
          { tabId: tab.id },
          "Input.insertText",
          { text: splitCode[0] }
        );
        for (let i = 1; i < splitCode.length; i++) {
          // 前の行が
          if (splitCode[i - 1].indexOf(" ") == 0) {
            await chrome.debugger.sendCommand(
              { tabId: tab.id },
              "Input.dispatchKeyEvent",
              selectIndent
            );
            await chrome.debugger.sendCommand(
              { tabId: tab.id },
              "Input.dispatchKeyEvent",
              deleteKey
            );
          }

          await chrome.debugger.sendCommand(
            { tabId: tab.id },
            "Input.insertText",
            { text: splitCode[i] }
          );
        }
      } else {
        // フォーマット済みのコードをクリップボードに書き込み
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (formattedCode) => {
            navigator.clipboard.writeText(formattedCode);
          },
          args: [formattedCode],
        });

        // クリップボードの内容をペースト
        await chrome.debugger.sendCommand(
          { tabId: tab.id },
          "Input.dispatchKeyEvent",
          paste
        );
      }
      // デバッガをデタッチ
      await chrome.debugger.detach({ tabId: tab.id });
    })();
  }
});
