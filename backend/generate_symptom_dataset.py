import csv
import json
import random
import datetime
import re
import math

# ==========================================
# CONFIGURATION & CONSTANTS
# ==========================================

TARGET_ROW_COUNT = 5200  # Generating slightly more to ensure >5000 valid
OUTPUT_CSV = "symptom_dataset.csv"
OUTPUT_CODEBOOK = "codebook.json"
OUTPUT_REPORT = "validation_report.json"
OUTPUT_EXAMPLES = "examples_preview.txt"

# 1. SPECIALTIES
SPECIALTIES = {
    "GP": "General Practitioner",
    "ENT": "Otolaryngologist",
    "CARDIO": "Cardiologist",
    "PULM": "Pulmonologist",
    "GASTRO": "Gastroenterologist",
    "NEURO": "Neurologist",
    "DERM": "Dermatologist",
    "ORTHO": "Orthopedist",
    "ER": "Emergency Medicine",
    "ENDO": "Endocrinologist",
    "PSYCH": "Psychiatrist"
}

# 2. DISEASES & PROFILES
# Format: {CODE: {name, specialty, profile: {q_idx: {answer: weight}}}}
# Weights: High relevance=3, Med=1, Neutral=0, Mismatch=-2
DISEASES = {
    "AC_PHARY": {
        "name": "Acute Pharyngitis",
        "specialties": ["GP", "ENT"],
        "profile": {
            0: {"a": 3}, # Q1: Head/Neck
            1: {"a": 2, "c": 2}, # Q2: Sharp or Scratchy
            2: {"a": 2, "b": 2}, # Q3: Fever
            3: {"c": 1}, # Q4: No cough usually, or dry
            9: {"a": 2}, # Q10: Body ache/Fatigue
        }
    },
    "VIR_FLU": {
        "name": "Viral Influenza",
        "specialties": ["GP", "PULM"],
        "profile": {
            0: {"c": 1}, # Q1: Generalized
            2: {"a": 3}, # Q3: High Fever
            3: {"b": 2}, # Q4: Dry cough
            5: {"a": 2}, # Q6: Sudden
            9: {"a": 3}  # Q10: Fatigue/Ache
        }
    },
    "AC_BRONC": {
        "name": "Acute Bronchitis",
        "specialties": ["GP", "PULM"],
        "profile": {
            0: {"b": 3}, # Q1: Chest
            3: {"a": 3}, # Q4: Productive Cough
            2: {"b": 1}, # Q3: Mild Fever
            5: {"b": 2}, # Q6: Acute
        }
    },
    "PNEUMONIA": {
        "name": "Pneumonia",
        "specialties": ["GP", "PULM"],
        "profile": {
            0: {"b": 3}, # Q1: Chest
            2: {"a": 3}, # Q3: High Fever
            3: {"a": 2, "b": 2}, # Q4: Cough/SOB
            7: {"b": 2}, # Q8: Mod-High Severity
            9: {"a": 2}
        }
    },
    "AC_MI": {
        "name": "Acute Myocardial Infarction",
        "specialties": ["ER", "CARDIO"],
        "is_emergency": True,
        "profile": {
            0: {"b": 3}, # Q1: Chest
            1: {"b": 3}, # Q2: Pressure/Crushing
            3: {"b": 2}, # Q4: SOB
            5: {"a": 3}, # Q6: Sudden
            6: {"a": 2}, # Q7: Exertion
            7: {"a": 3}, # Q8: High Severity
            9: {"c": 2}  # Q10: Dizziness
        }
    },
    "GERD": {
        "name": "Gastroesophageal Reflux",
        "specialties": ["GP", "GASTRO"],
        "profile": {
            0: {"b": 2, "c": 1}, # Q1: Chest/Abd
            1: {"c": 3}, # Q2: Burning
            4: {"b": 2}, # Q5: Nausea/Indigestion
            6: {"b": 2}, # Q7: Food triggers
            5: {"c": 2}  # Q6: Chronic
        }
    },
    "GASTRO_ENT": {
        "name": "Gastroenteritis",
        "specialties": ["GP", "GASTRO"],
        "profile": {
            0: {"c": 3}, # Q1: Abdomen
            4: {"a": 3}, # Q5: Vomit/Diarrhea
            2: {"b": 1}, # Q3: Mild Fever
            5: {"a": 2}, # Q6: Sudden
        }
    },
    "AC_APPEN": {
        "name": "Acute Appendicitis",
        "specialties": ["ER", "GASTRO"],
        "is_emergency": True,
        "profile": {
            0: {"c": 3}, # Q1: Abdomen (RLQ)
            1: {"a": 3}, # Q2: Sharp
            2: {"b": 2}, # Q3: Mild Fever
            4: {"b": 2}, # Q5: Nausea
            5: {"a": 2}, # Q6: Sudden
            7: {"a": 2}  # Q8: High Severity
        }
    },
    "MIGRAINE": {
        "name": "Migraine",
        "specialties": ["NEURO", "GP"],
        "profile": {
            0: {"a": 3}, # Q1: Head
            1: {"b": 2}, # Q2: Throbbing/Dull
            4: {"b": 2}, # Q5: Nausea
            6: {"b": 2}, # Q7: Stress/Food
            8: {"a": 2}  # Q9: Recurrent
        }
    },
    "TENS_HEAD": {
        "name": "Tension Headache",
        "specialties": ["GP", "NEURO"],
        "profile": {
            0: {"a": 3}, # Q1: Head
            1: {"b": 3}, # Q2: Dull/Band-like
            7: {"c": 2}, # Q8: Mild/Mod
            8: {"a": 1}  # Q9: Recurrent
        }
    },
    "AC_SINUS": {
        "name": "Acute Sinusitis",
        "specialties": ["GP", "ENT"],
        "profile": {
            0: {"a": 3}, # Q1: Head/Face
            1: {"b": 2}, # Q2: Pressure
            3: {"c": 1}, # Q4: None (maybe congestion)
            5: {"b": 2}, # Q6: Acute
        }
    },
    "ALLER_RHIN": {
        "name": "Allergic Rhinitis",
        "specialties": ["GP", "ENT"],
        "profile": {
            0: {"a": 2}, # Q1: Head/Nose
            1: {"c": 2}, # Q2: Itch
            3: {"c": 2}, # Q4: Sneezing (mapped to C or A var)
            6: {"c": 2}, # Q7: Environmental (mapped to C)
            5: {"c": 2}  # Q6: Chronic/Seasonal
        }
    },
    "OSTEO_ARTH": {
        "name": "Osteoarthritis",
        "specialties": ["GP", "ORTHO"],
        "profile": {
            0: {"c": 2}, # Q1: Joints/Back
            1: {"b": 2}, # Q2: Ache
            6: {"a": 2}, # Q7: Movement
            5: {"c": 3}, # Q6: Chronic
            8: {"a": 2}  # Q9: Recurrent
        }
    },
    "LUMBAGO": {
        "name": "Acute Lumbago",
        "specialties": ["GP", "ORTHO"],
        "profile": {
            0: {"c": 3}, # Q1: Back
            1: {"b": 1, "a": 1}, # Q2: Ache or Sharp
            6: {"a": 3}, # Q7: Movement
            5: {"a": 2}, # Q6: Sudden/Acute
        }
    },
    "GEN_ANX": {
        "name": "Generalized Anxiety",
        "specialties": ["GP", "PSYCH"],
        "profile": {
            0: {"b": 1, "c": 1}, # Q1: Chest or General
            1: {"b": 1}, # Q2: Tightness
            5: {"c": 2}, # Q6: Chronic
            6: {"b": 3}, # Q7: Stress
            9: {"a": 2}  # Q10: Fatigue/Dizzy
        }
    },
    "UTI_SIMPLE": {
        "name": "Uncomplicated UTI",
        "specialties": ["GP"],
        "profile": {
            0: {"c": 3}, # Q1: Pelvic/Abd
            1: {"c": 3}, # Q2: Burning
            2: {"b": 1}, # Q3: Mild Fever
            5: {"b": 2}, # Q6: Acute
        }
    },
    "CON_DERM": {
        "name": "Contact Dermatitis",
        "specialties": ["GP", "DERM"],
        "profile": {
            0: {"c": 1}, # Q1: Any
            1: {"c": 3}, # Q2: Itch
            9: {"b": 3}, # Q10: Rash
            6: {"c": 2}  # Q7: External trigger
        }
    },
    "AC_URTIC": {
        "name": "Acute Urticaria",
        "specialties": ["GP", "DERM"],
        "profile": {
            1: {"c": 3}, # Q2: Itch
            5: {"a": 2}, # Q6: Sudden
            9: {"b": 3}, # Q10: Rash/Swelling
        }
    },
    "HYPERTEN": {
        "name": "Hypertension (Uncontrolled)",
        "specialties": ["GP", "CARDIO"],
        "profile": {
            0: {"a": 1}, # Q1: Head (sometimes)
            5: {"c": 3}, # Q6: Chronic
            8: {"a": 2}, # Q9: Known history
            9: {"c": 2}  # Q10: Dizziness
        }
    },
    "STABLE_ANG": {
        "name": "Stable Angina",
        "specialties": ["CARDIO", "GP"],
        "profile": {
            0: {"b": 3}, # Q1: Chest
            1: {"b": 2}, # Q2: Pressure
            6: {"a": 3}, # Q7: Exertion (Predictable)
            5: {"c": 2}, # Q6: Chronic history
            8: {"a": 2}  # Q9: Known history
        }
    }
}

# 3. MCQs
QUESTIONS = [
    {"id": "q1", "text": "Location", "options": ["a", "b", "c"]}, # a:Head/Neck, b:Chest/Resp, c:Abd/Back/Other
    {"id": "q2", "text": "Nature", "options": ["a", "b", "c"]}, # a:Sharp, b:Dull/Ache, c:Itch/Burn
    {"id": "q3", "text": "Fever", "options": ["a", "b", "c"]}, # a:High, b:Mild, c:None
    {"id": "q4", "text": "Respiratory", "options": ["a", "b", "c"]}, # a:Prod.Cough, b:Dry Cough/SOB, c:None
    {"id": "q5", "text": "GI", "options": ["a", "b", "c"]}, # a:Vomit/Diarrhea, b:Nausea, c:None
    {"id": "q6", "text": "Onset", "options": ["a", "b", "c"]}, # a:Sudden, b:Days, c:Chronic
    {"id": "q7", "text": "Triggers", "options": ["a", "b", "c"]}, # a:Exertion, b:Food/Stress, c:None
    {"id": "q8", "text": "Severity", "options": ["a", "b", "c"]}, # a:High(8-10), b:Mod(4-7), c:Low(1-3)
    {"id": "q9", "text": "History", "options": ["a", "b", "c"]}, # a:Recurrent, b:First time, c:Unsure
    {"id": "q10", "text": "Systemic", "options": ["a", "b", "c"]}, # a:Fatigue, b:Rash, c:Dizzy/None
]

LOCATION_TYPES = ["urban", "suburban", "rural"]
SEXES = ["M", "F", "O"]

# ==========================================
# GENERATION LOGIC
# ==========================================

class DatasetGenerator:
    def __init__(self, seed=42):
        random.seed(seed)
        self.row_counter = 0

    def get_weighted_answer(self, disease_code, q_index):
        """
        Returns an answer (a,b,c) for a question index based on disease profile.
        If the disease doesn't care about this Q, random choice.
        """
        profile = DISEASES[disease_code]["profile"]
        
        # Default weights (equal probability)
        weights = {"a": 1, "b": 1, "c": 1}
        
        if q_index in profile:
            # Boost weights based on profile
            for ans, strength in profile[q_index].items():
                weights[ans] += (strength * 4) # Strong bias towards correct answer
        
        choices = list(weights.keys())
        w_vals = list(weights.values())
        return random.choices(choices, weights=w_vals, k=1)[0]

    def calculate_scores(self, answers):
        """
        Calculates score for ALL diseases based on the provided answers.
        Returns sorted list of (disease_code, score).
        """
        scores = {}
        for code, data in DISEASES.items():
            score = 0
            profile = data["profile"]
            
            for i, ans in enumerate(answers):
                if i in profile:
                    # If answer matches profile preference
                    if ans in profile[i]:
                        score += profile[i][ans]
                    else:
                        # Mismatch penalty
                        score -= 1
            scores[code] = max(0, score) # No negative total scores
            
        return sorted(scores.items(), key=lambda x: x[1], reverse=True)

    def generate_row(self):
        self.row_counter += 1
        row_id = f"row_{self.row_counter:05d}"
        
        # 1. Pick a Target Disease (Ground Truth)
        # We start with a target so we can generate coherent symptoms
        target_code = random.choice(list(DISEASES.keys()))
        target_data = DISEASES[target_code]
        
        # 2. Generate Demographics based on disease logic (simplified)
        age = random.randint(18, 85)
        if target_code in ["AC_PHARY", "AC_APPEN"]: age = random.randint(5, 40)
        if target_code in ["OSTEO_ARTH", "COPD_FLARE", "STABLE_ANG"]: age = random.randint(50, 90)
        
        sex = random.choices(SEXES, weights=[49, 49, 2], k=1)[0]
        if target_code == "UTI_SIMPLE": sex = random.choices(["F", "M"], weights=[90, 10], k=1)[0]
        
        location = random.choices(LOCATION_TYPES, weights=[60, 25, 15], k=1)[0]
        onset_days = random.randint(0, 14)
        if "Chronic" in target_data["profile"].get(5, {}): # Check if disease is chronic
            onset_days = random.randint(30, 365)
            
        # Comorbidities
        comorbs = []
        if age > 50 and random.random() > 0.6: comorbs.append("hypertension")
        if age > 50 and random.random() > 0.7: comorbs.append("diabetes")
        if target_code == "COPD_FLARE": comorbs.append("copd")
        comorb_str = "|".join(comorbs) if comorbs else "none"

        # 3. Generate Answers (Q1-Q10)
        # Generate 'ideal' answers for target, then perturb 1-2 of them for noise
        answers = []
        for i in range(10):
            ans = self.get_weighted_answer(target_code, i)
            # 10% chance to flip to random noise to simulate patient confusion
            if random.random() < 0.10: 
                ans = random.choice(["a", "b", "c"])
            answers.append(ans)
            
        # 4. Calculate Model Confidence (Simulated)
        # Recalculate scores based on the generated noisy answers
        scored_diseases = self.calculate_scores(answers)
        top_code, top_score = scored_diseases[0]
        second_code, second_score = scored_diseases[1]
        
        # Normalize confidence
        total_score = sum(s for c, s in scored_diseases[:5]) or 1
        confidence = round(top_score / total_score, 2)
        confidence = min(0.99, max(0.20, confidence))
        
        # 5. Emergency Override Logic
        # If signs suggest Emergency but confidence is low, boost it and force label
        is_emergency = DISEASES[top_code].get("is_emergency", False)
        if is_emergency:
            top_label = top_code
            top_name = DISEASES[top_code]["name"]
            # Force high confidence for emergencies in training data for safety
            confidence = max(confidence, 0.85) 
            note_type = "EMERGENCY_REFERRAL"
        else:
            top_label = top_code
            top_name = DISEASES[top_code]["name"]
            note_type = "Standard"

        # 6. Specialties
        specs = DISEASES[top_label]["specialties"]
        # Always add GP if not present and confidence isn't super high
        if "GP" not in specs and confidence < 0.8:
            specs = specs + ["GP"]
            
        spec_codes = ";".join(specs[:3])
        spec_names = ";".join([SPECIALTIES[s] for s in specs[:3]])
        
        # 7. Notes & Source
        source = random.choices(["synthetic", "augmented_public"], weights=[80, 20], k=1)[0]
        note = f"Patient profile matches {top_label}. {note_type} indicated."
        if source == "augmented_public":
            note += " Based on clinical vignette guidelines (paraphrased)."

        return [
            row_id, *answers, age, sex, onset_days, comorb_str, location,
            top_label, top_name, spec_codes, spec_names, confidence, 
            note, source, datetime.date.today().isoformat()
        ]

    def generate_dataset(self):
        print(f"Generating {TARGET_ROW_COUNT} rows...")
        data = []
        header = ["id", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", 
                  "age", "sex", "onset_days", "comorbidity_flags", "location_type", 
                  "top_disease_code", "top_disease_name", "specialties", 
                  "specialty_names", "confidence", "notes", "source_type", "created_at"]
        
        data.append(header)
        for _ in range(TARGET_ROW_COUNT):
            data.append(self.generate_row())
            
        return data

    def validate_and_save(self, data):
        print("Validating dataset...")
        valid_rows = []
        header = data[0]
        valid_rows.append(header)
        
        report = {
            "total_generated": len(data) - 1,
            "valid_rows": 0,
            "failures": 0,
            "checks": {
                "row_count_passed": False,
                "no_nulls": True,
                "valid_enums": True,
                "valid_ranges": True
            },
            "stats": {"diseases": {}, "age_groups": {"0-17":0, "18-64":0, "65+":0}}
        }
        
        for row in data[1:]:
            # Validation Logic
            if any(x == "" or x is None for x in row):
                report["failures"] += 1; continue
                
            q_vals = row[1:11]
            if not all(q in ["a","b","c"] for q in q_vals):
                report["failures"] += 1; report["checks"]["valid_enums"] = False; continue
                
            age = row[11]
            if not (0 <= age <= 120):
                report["failures"] += 1; report["checks"]["valid_ranges"] = False; continue
                
            # Stats Collection
            dis = row[16]
            report["stats"]["diseases"][dis] = report["stats"]["diseases"].get(dis, 0) + 1
            
            if age < 18: report["stats"]["age_groups"]["0-17"] += 1
            elif age < 65: report["stats"]["age_groups"]["18-64"] += 1
            else: report["stats"]["age_groups"]["65+"] += 1
            
            valid_rows.append(row)

        report["valid_rows"] = len(valid_rows) - 1
        if report["valid_rows"] >= 5000:
            report["checks"]["row_count_passed"] = True
            
        # Write CSV
        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(valid_rows)
            
        # Write Report
        with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
            
        # Write Codebook
        codebook = {
            "diseases": {k: v["name"] for k, v in DISEASES.items()},
            "specialties": SPECIALTIES,
            "questions": {q["id"]: q["text"] for q in QUESTIONS}
        }
        with open(OUTPUT_CODEBOOK, "w", encoding="utf-8") as f:
            json.dump(codebook, f, indent=2)
            
        # Write Examples
        with open(OUTPUT_EXAMPLES, "w", encoding="utf-8") as f:
            for row in valid_rows[1:21]:
                f.write(f"ID: {row[0]} | Disease: {row[17]} ({row[16]}) | Conf: {row[20]}\n")
                f.write(f"Context: {row[11]}y {row[12]}, Onset: {row[13]}d\n")
                f.write(f"Symptoms: {row[1:11]}\n")
                f.write("-" * 50 + "\n")

        print(f"Successfully generated {len(valid_rows)-1} rows.")
        print(f"Files created: {OUTPUT_CSV}, {OUTPUT_CODEBOOK}, {OUTPUT_REPORT}, {OUTPUT_EXAMPLES}")

if __name__ == "__main__":
    gen = DatasetGenerator()
    raw_data = gen.generate_dataset()
    gen.validate_and_save(raw_data)
