export type Message<T> = {
	endpoint: unknown
	messageId: string
	messageData?: T
}
