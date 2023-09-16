from fastapi import FastAPI
from pydantic import BaseModel
import subprocess
import os
import time

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
    formatted_code = subprocess.run(
        ["black", "--code", code.text], stdout=subprocess.PIPE
    )
    return {"text": formatted_code.stdout}