import json

with open("master_data.json", "r") as f:
    data = json.load(f)

# I wanna see, on average how many matches has every user played

user_match_dict = {}

print(data["AmbroseValley"])