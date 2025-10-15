# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code to the working directory
COPY . .

# Set a default port
ENV PORT=8080

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Make the start script executable
RUN chmod +x /app/start.sh

# Run the start script when the container launches
CMD ["/app/start.sh"]
