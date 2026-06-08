"""
Cliente asíncrono para la API de Google Gemini 2.5 Flash.

Usa httpx en lugar del SDK oficial para evitar dependencias pesadas.
Configuración unificada para todos los análisis de la aplicación:
    - temperature: 0.2  (respuestas precisas y consistentes)
    - maxOutputTokens: 2048
    - thinkingBudget: 1024 (razonamiento moderado antes de responder)

Referencia:
    https://ai.google.dev/gemini-api/docs/text-generation
"""

import httpx

from config import GEMINI_API_KEY, GEMINI_MODEL

# URL base del endpoint de generación de contenido de Gemini.
_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


async def generate_content(prompt: str) -> str:
    """Envía un prompt a Gemini y devuelve el texto generado.

    Args:
        prompt: Texto completo del prompt (sistema + datos + instrucciones).

    Returns:
        Texto plano con la respuesta de Gemini.

    Raises:
        RuntimeError: Si la API devuelve un error HTTP o la respuesta
                      no contiene texto generado.
    """
    url = f"{_BASE_URL}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 4096,
            "thinkingConfig": {
                "thinkingLevel": "low"  # minimal, low, medium, high
            },
        },
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload)

    if response.status_code != 200:
        raise RuntimeError(f"Gemini API error {response.status_code}: {response.text}")

    data = response.json()

    # Extrae el texto de la primera respuesta candidata.
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Respuesta inesperada de Gemini: {e}")
