import { Kafka } from "kafkajs";
import "dotenv/config";
import logger from "../utils/logger.util.js";

let kafka;
let producer;

export const initKafka = async () => {
  if (!kafka) {
    const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
    kafka = new Kafka({ clientId: "auth-service", brokers, logLevel: 5, logCreator: () => ({ namespace, level, label, log }) => {}, ssl: false });
    producer = kafka.producer({ quiet: true });
    await producer.connect();
    logger.info("Kafka connected");
  }
  return producer;
};

export const publishKafka = async (topic, message) => {
  if (!producer) throw new Error("Kafka producer not initialized");
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }]
  });
};
