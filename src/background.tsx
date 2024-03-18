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

      const tabId = tab.id!
      const code = await readCode(tabId)
      const formattedCode = await formatCode(code);
      await writeCode(tabId, formattedCode);
    })();
  }
});

async function readCode(tabId: number) {
  const code = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const codeElement = document.querySelector<HTMLTextAreaElement>(".cell.code.focused textarea")!
      return codeElement.value
    },
  });
  return code[0].result;
}

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

async function writeCode(tabId: number, code: string) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: async (code) => {
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // フォーカス中のテキストエリアにコードを書き込む
      const codeElement = document.querySelector<HTMLTextAreaElement>(".cell.code.focused textarea")!;
      const currentCaretPos = codeElement.selectionStart
      codeElement.setSelectionRange(0, codeElement.value.length); // 元のコードが残らないようにするため全選択する
      await sleep(1); // なぜか待機しないと正しくコードが書き込まれない。colab側のイベントリスナーが原因？
      codeElement.value = code;
      codeElement.dispatchEvent(new InputEvent("input")); // 手入力をシミュレートするためにイベントを発火
      await sleep(1);
      codeElement.setSelectionRange(currentCaretPos, currentCaretPos);
    },
    args: [code]
  });
}