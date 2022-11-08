import {Message} from "/lib/ipc/messaging/Message";

export type Request<T> = Message<T> & {
	requester: string
}
