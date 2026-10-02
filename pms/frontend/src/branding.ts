import { config } from './config';

/**
 * What the distribution hub is called on screen.
 *
 * Helio distributes through Beds24, and the property's own guests and clients
 * have no reason to know that — a channel-manager contract is a supplier
 * relationship, not a product feature, and naming it on screen tells every
 * customer who to go to directly.
 *
 * So the partner's name appears in exactly one place: this constant. Everything
 * user-facing reads it, nothing hardcodes it. Set `VITE_CHANNEL_HUB_NAME` to
 * change the label — including back to "Beds24" on an internal build, where the
 * setup instructions are easier to follow with the real name on them.
 *
 * Code comments still say Beds24 on purpose. They describe the system as it
 * actually is, and a developer reading `beds24.ts` is not the audience this is
 * hiding it from.
 */
export const CHANNEL_HUB: string = config.channelHubName;

/** Title-case form, for the start of a sentence or a field label. */
export const CHANNEL_HUB_TITLE: string =
  CHANNEL_HUB === 'the channel manager' ? 'The channel manager' : CHANNEL_HUB;

/** Possessive-free short form for labels: "Channel room id", not "the channel manager room id". */
export const CHANNEL_HUB_SHORT: string = config.channelHubShort;
