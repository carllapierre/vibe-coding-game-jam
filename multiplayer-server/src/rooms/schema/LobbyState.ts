import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id: string;
  @type("string") name: string;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  @type("number") rotationY: number = 0;
  @type("string") characterModel: string;
  @type("number") health: number = 100;
  @type("string") equippedItem: string = null;
  @type("number") score: number = 0;
  @type("string") clientId: string = null;
  @type("string") state: string = "idle";
}

export class LobbyState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
} 