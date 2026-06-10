import mongoose, { Schema } from 'mongoose';

export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    [
      {
        $set: {
          seq: { $add: [{ $ifNull: ['$seq', -1] }, 1] },
        },
      },
    ],
    { upsert: true, returnDocument: 'after', new: true }
  );
  return counter!.seq;
}
