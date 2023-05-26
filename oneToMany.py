import json
import os

def main():
    # Read the JSON file.
    with open("./AllInOneMetadata.json", "r") as f:
        data = json.load(f)

    # Get the universeInfo property.
    universeInfo = data["universeInfo"]

    # Create a new directory to store the JSON files.
    # if not os.path.exists("./Metadata/3"):
    #     os.mkdir("./Metadata/3")

    # Iterate over the universeInfo array.
    for i, universe in enumerate(universeInfo):
        # Write the JSON to a file.
        with open(f"./Metadata/3/{i + 1}", "w") as f:
            json.dump(universe, f, indent=2)

if __name__ == "__main__":
    main()