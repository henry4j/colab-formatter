import { loadPyodide } from "pyodide";

class Pyodide {
  pyodide: any;

  async init() {
    let pyodide = await loadPyodide({
      indexURL: "./pyodide",
    });
    await pyodide.loadPackage("micropip", { checkIntegrity: false });

    await pyodide.runPythonAsync(`
import micropip
await micropip.install("./wheel/black-23.12.1-py3-none-any.whl")
import black
      `);
    this.pyodide = pyodide;
  }
}

const pyodideClass = new Pyodide();
pyodideClass.init();

chrome.runtime.onMessage.addListener((request: any, _sender, callback) => {
  (async () => {
    try {
      const preformattedCode = request.code
      // 直接フォーマットさせるとエスケープ文字などの入力でエラーが発生するので、一度ファイルに書き出している
      pyodideClass.pyodide.FS.writeFile("./tmp.py", preformattedCode, {
        encoding: "utf8",
      });
      let formattedCode = await pyodideClass.pyodide.runPythonAsync(`
with open("./tmp.py", "r") as f:
    data = f.read()
code = black.format_str(data, mode=black.Mode())
code
`);
      formattedCode = formattedCode.replace(/\n$/, "");
      callback({ status: "success", code: formattedCode });
    } catch (e: any) {
      console.log(e.message);
      callback({ status: "error", code: request.code });
    }
  })();
  return true;
});
