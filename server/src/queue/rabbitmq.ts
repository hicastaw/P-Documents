import amqp from "amqplib";
import { loadEnv } from "../config/env";

const env = loadEnv();

let connection: amqp.ChannelModel | null = null;
let channel: amqp.Channel | null = null;

export const QUEUE_DOCUMENT_UPLOADED = "document_uploaded";

export async function getChannel(): Promise<amqp.Channel> {
  if (channel) return channel;
  connection = await amqp.connect(env.RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel!.assertQueue(QUEUE_DOCUMENT_UPLOADED, { durable: true });
  return channel!;
}

