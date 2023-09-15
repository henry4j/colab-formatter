from fastapi import FastAPI
from pydantic import BaseModel
import subprocess

app = FastAPI()
from starlette.middleware.cors import CORSMiddleware

# CORSを回避するために追加
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Code(BaseModel):
    text: str


@app.post("/")
def post(code: Code):
    with open("tmp.py", mode="w") as f:
        f.write(code.text)

    subprocess.run(["black", "tmp.py"])

    with open("tmp.py") as f:
        return {"text": f.read()}
