
import json
import os
import re
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


dynamodb = boto3.resource("dynamodb")
sns = boto3.client("sns")

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


def buscar_interessados(id_livro):
    interessados = []

    parametros = {
        "KeyConditionExpression": (
            Key("PK").eq(f"LIVRO#{id_livro}")
            & Key("SK").begins_with("INTERESSE#")
        ),
        "ConsistentRead": True
    }

    while True:
        resposta = tabela.query(**parametros)
        interessados.extend(resposta.get("Items", []))

        ultima_chave = resposta.get("LastEvaluatedKey")

        if not ultima_chave:
            break

        parametros["ExclusiveStartKey"] = ultima_chave

    return interessados


def notificar_interessados(id_livro, titulo):
    interessados = buscar_interessados(id_livro)

    notificados = 0
    pendentes = 0

    for interesse in interessados:
        if interesse.get("status") != "aguardando":
            continue

        email = interesse["email"]

        try:
            # Busca o tópico SNS do cliente
            resposta_cliente = tabela.get_item(
                Key={
                    "PK": f"CLIENTE#{email}",
                    "SK": "DADOS"
                },
                ConsistentRead=True
            )

            cliente = resposta_cliente.get("Item")

            if not cliente or not cliente.get("snsTopicArn"):
                pendentes += 1
                print(f"Cliente sem tópico SNS: {email}")
                continue

            # Publica a notificação
            sns.publish(
                TopicArn=cliente["snsTopicArn"],
                Subject="Sebo Online - Seu livro chegou!",
                Message=(
                    f"Olá!\n\n"
                    f"Boa notícia! O livro '{titulo}' "
                    f"chegou à nossa livraria.\n\n"
                    f"Compareça à livraria para "
                    f"efetivar a compra.\n\n"
                    f"Atenciosamente,\nSebo Online"
                )
            )

            # Marca o interesse como notificado
            tabela.update_item(
                Key={
                    "PK": f"LIVRO#{id_livro}",
                    "SK": f"INTERESSE#{email}"
                },
                UpdateExpression="SET #status = :notificado",
                ConditionExpression="#status = :aguardando",
                ExpressionAttributeNames={
                    "#status": "status"
                },
                ExpressionAttributeValues={
                    ":notificado": "notificado",
                    ":aguardando": "aguardando"
                }
            )

            notificados += 1

        except ClientError as erro:
            pendentes += 1
            print(f"Erro ao notificar {email}: {erro}")

    return notificados, pendentes


def lambda_handler(event, context):
    try:
        # Lê os dados da requisição
        body = event.get("body", event)

        if isinstance(body, str):
            body = json.loads(body)

        if not isinstance(body, dict):
            return responder(400, {
                "mensagem": "Dados inválidos."
            })

        id_livro = str(body.get("livroId", "")).strip()
        quantidade = body.get("quantidade")

        # Valida os dados
        if not re.fullmatch(r"[A-Za-z0-9_-]+", id_livro):
            return responder(400, {
                "mensagem": "ID do livro inválido."
            })

        if (
            isinstance(quantidade, bool)
            or not isinstance(quantidade, int)
            or quantidade <= 0
        ):
            return responder(400, {
                "mensagem": "Informe uma quantidade inteira positiva."
            })

        # Atualiza o estoque de forma atômica
        try:
            resposta = tabela.update_item(
                Key={
                    "PK": f"LIVRO#{id_livro}",
                    "SK": "DADOS"
                },
                UpdateExpression="ADD quantidade :valor",
                ConditionExpression=(
                    "attribute_exists(PK) "
                    "AND attribute_exists(SK)"
                ),
                ExpressionAttributeValues={
                    ":valor": Decimal(quantidade)
                },
                ReturnValues="ALL_NEW"
            )

        except ClientError as erro:
            if (
                erro.response["Error"]["Code"]
                == "ConditionalCheckFailedException"
            ):
                return responder(404, {
                    "mensagem": "Livro não encontrado."
                })

            raise

        livro = resposta["Attributes"]

        # Busca e notifica interessados
        notificados, pendentes = notificar_interessados(
            id_livro,
            livro["titulo"]
        )

        # Retorna o resultado
        return responder(200, {
            "mensagem": "Estoque atualizado.",
            "livroId": id_livro,
            "titulo": livro["titulo"],
            "quantidadeAtual": int(livro["quantidade"]),
            "notificacoesPublicadas": notificados,
            "notificacoesPendentes": pendentes
        })

    except (ValueError, TypeError, json.JSONDecodeError):
        return responder(400, {
            "mensagem": "Dados inválidos."
        })

    except Exception as erro:
        print(f"Erro ao atualizar estoque: {erro}")

        return responder(500, {
            "mensagem": "Erro interno ao atualizar estoque."
        })