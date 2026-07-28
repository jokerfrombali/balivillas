cd "D:\Projects\balivillas\tools\airbnb-importer"
docker build -t balivillas-airbnb-importer .
docker run --rm -p 8090:8090 -v "D:\Projects\balivillas:/workspace" balivillas-airbnb-importer
