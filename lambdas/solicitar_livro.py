
import json
import os
import re

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError


dynamodb = boto3.resource("dynamodb")
sns = boto3.client("sns")

tabela = dynamodb.Table(
    os.environ.get("TABELA_LIVROS", "Livraria")
)


def responder(status, mensagem):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "mensagem": mensagem
        }, ensure_ascii=False)
    }


def lambda_handler(event, context):
    try:
        # Recebe os dados enviados pelo frontend
        body = event.get("body", event)

        if isinstance(body, str):
            body = json.loads(body)

        if not isinstance(body, dict):
            return responder(400, "Dados inválidos.")

        id_livro = str(body.get("livroId", "")).strip()
        email = str(body.get("email", "")).strip().lower()

        # Valida os dados recebidos
        if not re.fullmatch(r"[A-Za-z0-9_-]+", id_livro):
            return responder(400, "ID do livro inválido.")

        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            return responder(400, "E-mail inválido.")

        # Consulta o livro no DynamoDB
        resposta = tabela.get_item(
            Key={
                "PK": f"LIVRO#{id_livro}",
                "SK": "DADOS"
            },
            ConsistentRead=True
        )

        livro = resposta.get("Item")

        if not livro:
            return responder(404, "Livro não encontrado.")

        # Busca o cadastro do cliente
        resposta_cliente = tabela.get_item(
            Key={
                "PK": f"CLIENTE#{email}",
                "SK": "DADOS"
            },
            ConsistentRead=True
        )

        cliente = resposta_cliente.get("Item")

        if not cliente or not cliente.get("snsTopicArn"):
            return responder(
                400,
                "Cliente sem tópico SNS cadastrado."
            )

        # Verifica se o livro está disponível
        quantidade = int(livro["quantidade"])

        if quantidade > 0:
            # Publica uma notificação no SNS
            sns.publish(
                TopicArn=cliente["snsTopicArn"],
                Subject="Sebo Online - Livro disponível",
                Message=(
                    f"Olá!\n\n"
                    f"O livro '{livro['titulo']}' está "
                    f"disponível em nossa livraria.\n\n"
                    f"Compareça à livraria para "
                    f"efetivar a compra.\n\n"
                    f"Atenciosamente,\nSebo Online"
                )
            )

            return responder(
                200,
                "Livro disponível! Notificação publicada no SNS."
            )

        # Se estiver indisponível, registra o interesse
        try:
            tabela.put_item(
                Item={
                    "PK": f"LIVRO#{id_livro}",
                    "SK": f"INTERESSE#{email}",
                    "email": email,
                    "status": "aguardando"
                },
                ConditionExpression=(
                    Attr("SK").not_exists()
                    | Attr("status").eq("notificado")
                )
            )

        except ClientError as erro:
            codigo = erro.response["Error"]["Code"]

            if codigo == "ConditionalCheckFailedException":
                return responder(
                    200,
                    "Seu interesse já está registrado."
                )

            raise

        return responder(
            200,
            "Livro indisponível. Interesse registrado!"
        )

    except (ValueError, TypeError, json.JSONDecodeError):
        return responder(400, "Dados inválidos.")

    except ClientError as erro:
        print(f"Erro AWS: {erro}")

        return responder(
            500,
            "Erro ao acessar os serviços AWS."
        )

    except Exception as erro:
        print(f"Erro inesperado: {erro}")

        return responder(
            500,
            "Erro interno ao processar solicitação."
        )
