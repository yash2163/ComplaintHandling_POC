import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from datetime import datetime

# Initialize Firestore (Auto-detects ADC)
# If running locally without ADC, might need 'gcloud auth application-default login'
if not firebase_admin._apps:
    app = firebase_admin.initialize_app()

db = firestore.client()

def seed_passengers():
    print("Seeding Passengers...")
    passengers = [
        {
            "pnr": "ABC123",
            "customerName": "John Doe",
            "email": "john.doe@example.com",
            "phone": "+919876543210",
            "flightNumber": "6E-123",
            "flightDate": datetime.now().strftime("%Y-%m-%d"), # Today
            "seatNumber": "12A",
            "source": "DEL",
            "destination": "BOM"
        },
        {
            "pnr": "XYZ789",
            "customerName": "Jane Smith",
            "email": "jane.smith@example.com",
            "phone": "+919988776655",
            "flightNumber": "6E-456",
            "flightDate": datetime.now().strftime("%Y-%m-%d"),
            "seatNumber": "14C",
            "source": "BOM",
            "destination": "BLR"
        }
    ]

    for p in passengers:
        db.collection("passengers").document(p["pnr"]).set(p)
        print(f"  Added PNR: {p['pnr']}")

def seed_weather():
    print("Seeding Flight Weather...")
    # Mocking METAR data for today's flights
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    weather_data = [
        {
            "flightNumber": "6E-123",
            "originStation": "DEL",
            "date": today_str,
            "metarRaw": "VIDP 162330Z 00000KT 1000 R28/1500D FG VV002 12/11 Q1013 NOSIG",
            "weather": "Fog",
            "visibility": "1000m",
            "wind": "00000KT",
            "impact": "HIGH" # High impact weather
        },
        {
            "flightNumber": "6E-456",
            "originStation": "BOM",
            "date": today_str,
            "metarRaw": "VABB 162330Z 27005KT 6000 FEW025 28/24 Q1010 NOSIG",
            "weather": "Clear",
            "visibility": "6000m",
            "wind": "27005KT",
            "impact": "LOW"
        }
    ]

    for w in weather_data:
        # Create a unique ID for the weather record, e.g., FlightNum_Date
        doc_id = f"{w['flightNumber']}_{w['date']}"
        db.collection("flight_weather").document(doc_id).set(w)
        print(f"  Added Weather for: {doc_id}")

if __name__ == "__main__":
    seed_passengers()
    seed_weather()
    print("✅ Seeding Complete.")
