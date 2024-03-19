// コードフォーマット用のoffscreenを作成
chrome.offscreen.createDocument({
  url: "offscreen.html",
  reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
  justification: "reason for needing the document",
});

// ショートカットキー入力時に以下の関数が実行される
chrome.commands.onCommand.addListener((commands, tab) => {
  if (commands === "format") {
    (async function () {
      // フォーマットをする必要が無いサイトでは以降の処理をスキップ
      const permittedUrl = ["https://colab.research.google.com/", "https://www.kaggle.com/"]
      const isPermitted = permittedUrl.some((url) => { return tab.url?.indexOf(url) === 0; });
      if (!isPermitted) {
        return;
      }

      // chrome.debugger APIを有効にする
      await chrome.debugger.attach({ tabId: tab.id }, "1.3");

      // コードをフォーマットしてセルに書き込む
      const os = (await chrome.runtime.getPlatformInfo()).os;
      const codeController = os === "mac" ? new MacCodeController(tab.id!) : new CodeController(tab.id!)
      const code = await codeController.readCode();
      const formattedCode = await formatCode(code);
      await codeController.writeCode(formattedCode);

      // chrome.debugger APIを無効にする
      await chrome.debugger.detach({ tabId: tab.id });
    })();
  }
});


async function formatCode(code: string) {
  const response = await chrome.runtime.sendMessage({ code: code }); // offscreenにコードを送り、フォーマットする
  if (response.status === "error") {
    chrome.notifications.create("", {
      title: "colab-formatter",
      message: "エラーによりフォーマット出来ませんでした",
      iconUrl: chrome.runtime.getURL("icon48.png"),
      type: "basic",
    });
  }
  return response.code;
}

class CodeController {
  readonly tabId: number;
  key: Key;

  constructor(tabId: number) {
    this.tabId = tabId;
    this.key = new Key(tabId, false);
  }

  async readCode() {
    await this.key.press("allSelect")
    await this.key.press("copy")
    const code = await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: async () => {
        return await navigator.clipboard.readText();
      },
    });
    return code[0].result;
  }

  async writeCode(code: string) {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: (text) => {
        navigator.clipboard.writeText(text);
      },
      args: [code],
    });
    await this.key.press("paste")
  }
}

class MacCodeController {
  readonly tabId: number;
  key: Key;

  constructor(tabId: number) {
    this.tabId = tabId;
    this.key = new Key(tabId, true);
  }

  async readCode() {
    await this.key.press("allSelect")

    const code = await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: () => {
        // コードに関連するHTML要素のリストを取得
        const code = [
          ...document.querySelectorAll<HTMLElement>(
            ".cell.code.focused .view-line"
          ),
        ];

        // リストの順番がコードの順番と同じとは限らないため、正しい順番にソートする
        // CSSのtopの値が正しいコードの順番になっているようなので、topの値を基準にソートしている
        code.sort(function (first, second) {
          const firstStyleTop = Number(first.style.top.replace("px", ""));
          const secondStyleTop = Number(second.style.top.replace("px", ""));
          return firstStyleTop - secondStyleTop;
        });

        // リストからコード本体を取得
        let combinedCode = "";
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
    return code[0].result;
  }

  async writeCode(code: string) {
    const splitCode = code.split(/(?<=\r\n|\n)/);
    await this.insertText(splitCode[0]);

    for (let i = 1; i < splitCode.length; i++) {
      // 前の行にインデントがある場合は、改行時にエディタ側で挿入される自動インデントを削除する
      if (splitCode[i - 1].indexOf(" ") === 0) {
        await this.key.press("selectIndent")
        await this.key.press("deleteKey")
      }

      await this.insertText(splitCode[i]);
    }
  }

  async insertText(text: string) {
    await chrome.debugger.sendCommand({ tabId: this.tabId }, "Input.insertText", {
      text: text,
    });
  }
}

class Key {
  readonly tabId: number;
  readonly keyCommandParams;

  constructor(tabId: number, isMac: boolean) {
    const ctrl = 2;
    const command = 4;
    const shift = 8;
    const modifiers = isMac ? command : ctrl; // OSによって修飾キーを変える

    this.tabId = tabId
    this.keyCommandParams = {
      paste: {
        type: "keyDown",
        windowsVirtualKeyCode: 86,
        modifiers: ctrl,
      },
      copy: {
        type: "keyDown",
        windowsVirtualKeyCode: 67,
        modifiers: ctrl,
      },
      deleteKey: {
        type: "keyDown",
        windowsVirtualKeyCode: 8,
      },
      selectIndent: {
        type: "keyDown",
        windowsVirtualKeyCode: 36,
        modifiers: shift,
      },
      allSelect: {
        type: "keyDown",
        windowsVirtualKeyCode: 65,
        modifiers: modifiers,
      }
    }
  }

  async press(key: keyof typeof this.keyCommandParams) {
    await chrome.debugger.sendCommand(
      { tabId: this.tabId },
      "Input.dispatchKeyEvent",
      this.keyCommandParams[key]
    );
  }
}
