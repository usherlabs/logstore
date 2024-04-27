import 'reflect-metadata'

import {
  ContentType,
  EncryptionType,
  MessageID,
  SignatureType,
  StreamMessage,
  StreamPartIDUtils,
  toStreamID
} from '@streamr/protocol'
import { randomEthereumAddress, startTestServer } from '@streamr/test-utils'
import { convertStreamMessageToBytes } from '@streamr/trackerless-network'
import { collect, hexToBinary, toLengthPrefixedFrame, utf8ToBinary } from '@streamr/utils'
import { range } from 'lodash'

import { Queries } from '../../src/Queries'
import { mockLoggerFactory } from '../test-utils/utils'

const createQueries = (serverUrl: string) => {
  return new Queries(
    {
      getRandomNodeUrl: async () => serverUrl,
    } as any,
    {
      getAddress: async () => randomEthereumAddress(),
      createMessageSignature: async () => new Uint8Array([]),

    } as any,
    Object as any,
    mockLoggerFactory(),
    undefined as any,
    undefined as any,
  );
}

describe('Queries', () => {

  it('large response', async () => {
    // larger than PuhsBuffer DEFAULT_BUFFER_SIZE
    const MESSAGE_COUNT = 257
    const streamPartId = StreamPartIDUtils.parse('stream#0')
    const server = await startTestServer('/stores/:streamId/data/partitions/:partition/:resendType', async (_req, res) => {
      const publisherId = randomEthereumAddress()
      for (const _ of range(MESSAGE_COUNT)) {
        const msg = new StreamMessage({
          messageId: new MessageID(toStreamID('streamId'), 0, 0, 0, publisherId, ''),
          content: utf8ToBinary(JSON.stringify({})),
          signature: hexToBinary('0x1234'),
          contentType: ContentType.JSON,
          encryptionType: EncryptionType.NONE,
          signatureType: SignatureType.SECP256K1
        })
        res.write(toLengthPrefixedFrame(convertStreamMessageToBytes(msg)))
      }
      res.end()
    })
    const queries = createQueries(server.url)
    const response = await queries.query(streamPartId, { last: MESSAGE_COUNT }, { raw: true })
    const messages = await collect(response.messageStream)
    expect(messages.length).toBe(MESSAGE_COUNT)
    await server.stop()
  })
});
