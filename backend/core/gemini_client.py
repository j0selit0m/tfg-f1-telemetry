"""
Cliente asíncrono para la API de Google Gemini.

Usa httpx en lugar del SDK oficial de Google para evitar dependencias
pesadas. Solo necesita la API key y el modelo como configuración.

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
            "temperature": 0.7,
            "maxOutputTokens": 1024,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)

    if response.status_code != 200:
        raise RuntimeError(f"Gemini API error {response.status_code}: {response.text}")

    data = response.json()

    # Extrae el texto de la primera respuesta candidata.
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Respuesta inesperada de Gemini: {e}")
