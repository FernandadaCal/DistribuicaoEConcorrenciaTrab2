
import json
import os

import boto3
from boto3.dynamodb.conditions import Attr


dynamodb = boto3.resource("dynamodb")

tabela = dynamodb.Table(
    os.environ.get("TABELA_LIVROS", "Livraria")
)


def responder(status, dados):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(dados, ensure_ascii=False)
    }


def lambda_handler(event, context):
    try:
        livros = []

        parametros = {
            "FilterExpression": (
                Attr("PK").begins_with("LIVRO#")
                & Attr("SK").eq("DADOS")
            )
        }

        while True:
            resposta = tabela.scan(**parametros)

            livros.extend(resposta.get("Items", []))

            ultima_chave = resposta.get("LastEvaluatedKey")

            if not ultima_chave:
                break

            parametros["ExclusiveStartKey"] = ultima_chave

        resultado = []

        for livro in livros:
            resultado.append({
                "id": livro["PK"].replace("LIVRO#", "", 1),
                "titulo": livro["titulo"],
                "autor": livro["autor"],
                "quantidade": int(livro["quantidade"])
            })

        resultado.sort(key=lambda l: l["titulo"])

        return responder(200, resultado)

    except Exception as erro:
        print(f"Erro ao listar livros: {erro}")

        return responder(500, {
            "mensagem": "Erro ao consultar os livros."
        })
