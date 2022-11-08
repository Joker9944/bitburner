import {Message} from "/lib/ipc/messaging/Message";

export type Response<T> = Message<T> & {
	host: string
}
