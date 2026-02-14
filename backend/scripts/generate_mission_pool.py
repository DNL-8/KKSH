import asyncio
import json
import os
import random
import re
import time
from typing import Any, List, Dict
from google import genai
import sys
from pathlib import Path

# Add backend to sys.path to allow imports from app
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(backend_dir))

from app.core.config import settings

API_KEY = settings.gemini_api_key
if not API_KEY:
    print("ERRO: GEMINI_API_KEY nao configurada no settings/ambiente.")
    exit(1)

client = genai.Client(api_key=API_KEY)

SUBJECTS = [
    "SQL", "Python", "Excel", "Data Modeling", "Cloud", 
    "ETL", "Spark", "Kafka", "dbt", "Airflow", "General"
]

RANKS = ["F", "E", "D", "C", "B", "A", "S"]

OUTPUT_FILE = "missions_pool.json"

async def generate_batch_with_retry(prompt, subject, rank, model_name, max_retries=5) -> List[Dict[str, Any]]:
    base_delay = 20  # Start with 20s delay if hit
    
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
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
            err_str = str(e)
            if "429" in err_str or "quota" in err_str.lower():
                # Try to extract duration
                # "Please retry in 43.419686187s."
                wait_time = base_delay * (attempt + 1)
                match = re.search(r"retry in (\d+(\.\d+)?)s", err_str)
                if match:
                    wait_time = float(match.group(1)) + 2 # Add buffer
                
                print(f"\n[429] Limit hit for {subject} {rank}. Waiting {wait_time:.1f}s (Attempt {attempt+1}/{max_retries})...")
                await asyncio.sleep(wait_time)
            else:
                print(f"Erro gerando {subject} [{rank}]: {e}")
                return []
    
    print(f"FAILED {subject} {rank} after {max_retries} retries.")
    return []

async def generate_batch(subject: str, rank: str, count: int) -> List[Dict[str, Any]]:
    # Use model from settings or fallback
    model_name = settings.gemini_model or "gemini-2.0-flash-exp"
    
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
    
    return await generate_batch_with_retry(prompt, subject, rank, model_name)

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
                # Rate limit safety: 5 RPM = 1 req / 12s. Validating with 15s to be safe.
                await asyncio.sleep(15) 
            
            print(f" {len(rank_missions)} ok")
            all_missions[subject].extend(rank_missions)
            total_generated += len(rank_missions)
            
    # Save to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_missions, f, indent=2, ensure_ascii=False)
        
    print(f"\nConcluido! {total_generated} missoes salvas em {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())
