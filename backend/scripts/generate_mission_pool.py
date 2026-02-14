import asyncio
import json
import os
import random
from typing import Any, List, Dict
import google.generativeai as genai
import sys
from pathlib import Path

# Add backend to sys.path to allow imports from app
# backend/scripts/generate.py -> parent=scripts -> parent.parent=backend
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from app.core.config import settings

API_KEY = settings.gemini_api_key
if not API_KEY:
    print("ERRO: GEMINI_API_KEY nao configurada no settings/ambiente.")
    exit(1)

genai.configure(api_key=API_KEY)

SUBJECTS = [
    "SQL", "Python", "Excel", "Data Modeling", "Cloud", 
    "ETL", "Spark", "Kafka", "dbt", "Airflow", "General"
]

RANKS = ["F", "E", "D", "C", "B", "A", "S"]
MISSIONS_PER_RANK_PER_SUBJECT = 14  # ~100 total per subject (14 * 7 = 98) + 2 extra?
# Let's do 15 to be safe (105 total) -> trim later.

OUTPUT_FILE = "missions_pool.json"

async def generate_batch(subject: str, rank: str, count: int) -> List[Dict[str, Any]]:
    # Use model from settings or fallback
    model_name = settings.gemini_model or "gemini-2.0-flash-exp"
    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config={"response_mime_type": "application/json"}
    )
    
    prompt = (
        f"Gere {count} missoes de estudo de RPG para o assunto '{subject}' no Rank '{rank}'. "
        "Responda APENAS um JSON array de objetos. "
        "Formato de cada objeto: "
        "{'title': str, 'description': str, 'objective': str, 'target_minutes': int, 'difficulty': str, 'tags': [str]}. "
        "Difficulty deve ser 'easy', 'medium', 'hard', ou 'elite' baseado no Rank. "
        "Target minutes deve ser realista para o rank (F=15-30min, S=60-120min). "
        "Use termos tecnicos corretos do assunto. "
        "Seja criativo nos titulos (ex: 'Operacao Join', 'Protocolo Pipeline')."
        "Idioma: PT-BR."
    )
    
    try:
        response = await model.generate_content_async(prompt)
        text = response.text
        # Clean markdown if present
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        data = json.loads(text)
        if isinstance(data, list):
            # Enforce fields
            valid = []
            for item in data:
                item["subject"] = subject
                item["rank"] = rank
                valid.append(item)
            return valid
        return []
    except Exception as e:
        print(f"Erro gerando {subject} [{rank}]: {e}")
        return []

async def main():
    all_missions = {} # {subject: [missions]}
    
    total_generated = 0
    
    for subject in SUBJECTS:
        print(f"\n--- Gerando para {subject} ---")
        all_missions[subject] = []
        
        for rank in RANKS:
            print(f"  > Rank {rank}...", end="", flush=True)
            # Generate in batches of 5 to avoid timeouts/limits match
            # 15 missions needed -> 3 batches of 5
            rank_missions = []
            for _ in range(3): 
                batch = await generate_batch(subject, rank, 5)
                rank_missions.extend(batch)
                print(".", end="", flush=True)
                await asyncio.sleep(1) # Rate limit courtesy
            
            print(f" {len(rank_missions)} ok")
            all_missions[subject].extend(rank_missions)
            total_generated += len(rank_missions)
            
    # Save to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_missions, f, indent=2, ensure_ascii=False)
        
    print(f"\nConcluido! {total_generated} missoes salvas em {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())
