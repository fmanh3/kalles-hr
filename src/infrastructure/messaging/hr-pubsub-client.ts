import { PubSub } from '@google-cloud/pubsub';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Fristående PubSubClient för HR-domänen för att undvika cross-repo dependencies vid runtime.
 */
export class HRPubSubClient {
  private pubsub: PubSub;
  private projectId: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'joakim-hansson-lab';
    this.pubsub = new PubSub({ projectId: this.projectId });
  }

  async subscribe(topicName: string, subscriptionName: string, callback: (data: any) => void) {
    console.log(`[HR-PubSub] Prenumererar på ${topicName}...`);
    const topic = this.pubsub.topic(topicName);
    const [subscription] = await topic.subscription(subscriptionName).get({ autoCreate: true });

    subscription.on('message', async (message: any) => {
      const data = JSON.parse(message.data.toString());
      callback(data);
      message.ack();
    });
  }
}
