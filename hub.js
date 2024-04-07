import fs from 'fs'
import expand from '@inquirer/expand'
import select from '@inquirer/select'
import { createHash } from 'crypto'
import { input } from '@inquirer/prompts'
import { inspect } from 'util'
import { config } from 'dotenv'

// ******** ENV ********
process.removeAllListeners('warning')
config('.env')

const fcDomain = process.env.HUB_DOMAIN
const wpDomain = process.env.WARPCAST_API_DOMAIN

// ******** API list ********
const apis = {
    // ******** Info API ********
    hubInfo: () => `${ fcDomain }/info?dbstats=1`,

    // ******** User API ********
    userDataByFid: (fid, userDataType) => `${ fcDomain }/userDataByFid?fid=${ fid }&user_data_type=${ userDataType ?? 6 }`,
    usernameProofByName: username  => `${ fcDomain }/userNameProofByName?name=${ username }`,
    linkByFid: (fid, targetFid) => `${ fcDomain }/linkById?fid=${ fid }&target_fid=${ targetFid }&link_type=follow`,

    // ******** Cast API ********
    castByFid: (fid, hash) => `${ fcDomain }/castById?fid=${ fid }&hash=${ hash }`,
    castsByFid: fid => `${ fcDomain }/castsByFid?fid=${ fid }`,
    castsByParent: (parentFid, parentHash, parentUrl) => {
        if(parentFid && parentHash) {
            return `${ fcDomain }/castsByParent?fid=${ parentFid }&hash=${ parentHash }`
        } else if(parentUrl) {
            return `${ fcDomain }/castsByParent?url=${ parentUrl }`
        } else {
            return undefined
        }
    },

    // ******** Message API ********
    validateMessage: () => `${ fcDomain }/validateMessage`,

    // ******** Reaction API ********
    reactionByFid: (fid, reactionType, targetFid, targetHash) => `${ fcDomain }/reactionById?fid=${ fid }&reaction_type=${ reactionType }&target_fid=${ targetFid }&target_hash=${ targetHash }`,

    // ******** Channel API ********
    allChannels: () => `${ wpDomain }/all-channels`,
}

// ******** Tools ********
const log = (result) => {
    const info = inspect(result, {
        depth: null,
        colors: true
    })
    console.log(info)
}

// ******** API executor ********
const hubInfo = async () => {
    const response = await fetch(apis.hubInfo())
    const result = await response.json()
    log(result)
}

// ******** User API ********
const userDataByFid = async () => {
    const fid = await input({ message: 'fid: ' })

    const userDataType = await select({
        message: 'user_data_type: ',
        choices: [
            {
                name: 'USER_DATA_TYPE_PFP',
                value: 1,
                description: 'Profile picture for the user'
            },
            {
                name: 'USER_DATA_TYPE_DISPLAY',
                value: 2,
                description: 'Display name for the user'
            },
            {
                name: 'USER_DATA_TYPE_BIO',
                value: 3,
                description: 'Bio for the user'
            },
            {
                name: 'USER_DATA_TYPE_URL',
                value: 5,
                description: 'URL for the user'
            },
            {
                name: 'USER_DATA_TYPE_USERNAME',
                value: 6,
                description: 'Preferred name for the user'
            }
        ]
    })

    const response = await fetch(apis.userDataByFid(fid, userDataType))
    const result = await response.json()
    log(result)
}

const userNameProofByName = async () => {
    const username = await input({ message: 'username: ' })

    const response = await fetch(apis.usernameProofByName(username))
    const result = await response.json()
    log(result)
}

const linkByFid = async () => {
    const fid = await input({ message: 'fid: ' })
    const targetFid = await input({ message: 'targetFid: ' })

    const response = await fetch(apis.linkByFid(fid, targetFid))
    const result = await response.json()
    log(result)
}

// ******** Cast API ********
const castByFid = async () => {
    const fid = await input({ message: 'fid: ' })
    const hash = await input({ message: 'hash: ' })

    const response = await fetch(apis.castByFid(fid, hash))
    const result = await response.json()
    log(result)
}

const storeInfoFileOrPrintStream = async (info, filename) => {
    const wannaGenerateFile = await select({
        message: 'Store casts into a file? ',
        choices: [
            {
                name: 'YES',
                value: true
            },
            {
                name: 'NO',
                value: false
            }
        ]
    })

    if(wannaGenerateFile) {
        const stream = fs.createWriteStream(filename)
        stream.write(JSON.stringify(info, null, 2) + '\n', 'utf-8', () => {
            console.log(`Done! View ${ filename }`);
        })
        stream.end()
    } else {
        log(info)
    }
}

const castsByFid = async () => {
    const fid = await input({ message: 'fid: ' })

    const response = await fetch(apis.castsByFid(fid))
    const result = await response.json()

    const castTypeFilter = await select({
        message: 'filter: ',
        choices: [
            {
                name: 'Hide the Remove-Message',
                value: 'MESSAGE_TYPE_CAST_REMOVE'
            },
            {
                name: 'Hide the Add-Message',
                value: 'MESSAGE_TYPE_CAST_ADD'
            },
            {
                name: 'Show All',
                value: 'ALL'
            },
        ]
    })

    const filtered = castTypeFilter !== 'ALL' ? result.messages.filter(item => item.data.type !== castTypeFilter) : result.messages
    const filename = `casts.${ fid }.${ castTypeFilter }.${ new Date().getTime() }.json`
    storeInfoFileOrPrintStream(filtered, filename)
}

const castsByParent = async () => {
    const parentTypeFilter = await select({
            message: 'Query params type: ',
        choices: [
            {
                name: 'parent fid + parent hash',
                value: 1
            },
            {
                name: 'parent url',
                value: 2
            },
        ]
    })

    let result = null

    if(parentTypeFilter === 1) {
        const parentFid = await input({ message: 'parent fid: ' })
        const parentHash = await input({ message: 'parent hash: ' })

        const response = await fetch(apis.castsByParent(parentFid, parentHash))
        result = await response.json()

        const filename = `casts.${ parentFid }.${ parentHash }.${ new Date().getTime() }.json`
        await storeInfoFileOrPrintStream(result, filename)
    } else {
        const parentUrl = await input({ message: 'parent url: ' })

        const response = await fetch(apis.castsByParent(undefined, undefined, parentUrl))
        result = await response.json()

        const filename = `casts.${ createHash('md5').update(parentUrl).digest('hex').substring(0, 4) }.${ new Date().getTime() }.json`
        await storeInfoFileOrPrintStream(result, filename)
    }
}

// ******** Message API ********
const validateMessage = async () => {
    const protobuf = await input({ message: 'message encoded protobuf: ' })

    const binaryData =  new Uint8Array(
        protobuf.match(/.{1,2}/g).map(
            (byte) => parseInt(byte, 16)
        )
    )

    const response = await fetch(
        apis.validateMessage(),
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: binaryData
        }
    )

    const result = await response.json()
    log(result)
}


// ******** Reaction API ********
const reactionByFid = async () => {
    const fid = await input({ message: 'fid: ' })
    const reactionType = await select({
        message: 'reactType: ',
        choices: [
            {
                name: 'REACTION_TYPE_LIKE',
                value: 1
            },
            {
                name: 'REACTION_TYPE_RECAST',
                value: 2
            },
        ]
    })
    const targetFid = await input({ message: 'targetFid: ' })
    const targetHash = await input({ message: 'targetHash: ' })

    const response = await fetch(apis.reactionByFid(fid, reactionType, targetFid, targetHash))
    const result = await response.json()
    log(result)
}

// ******** Channel API ********
const allChannels = async () => {
    const nameFilter = await input({ message: 'channel name: ' })

    const response = await fetch(apis.allChannels())
    const result = await response.json()
    const filtered = nameFilter ? result.result.channels.filter(item => item.name === nameFilter) : result.result.channels
    log(filtered)
}

// ******** Run ********
(async () => {
    if(!fcDomain || !wpDomain) {
        console.log('Please set .env file, refer to README.md')
        return
    }

    const call = [
        // ******** Info API ********
        hubInfo,

        // ******** User API ********
        userDataByFid,
        userNameProofByName,
        linkByFid,

        // ******** Cast API ********
        castByFid,
        castsByFid,
        castsByParent,

        // ******** Message API ********
        validateMessage,

        // ******** Reaction API ********
        reactionByFid,

        // ******** Channel API ********
        allChannels,
    ]

    try {
        const option = await expand({
            message: 'Choose an api: ',
            default: '1',
            expanded: true,
            choices: (
                call.map((item, index) => {
                    return {
                        key: index.toString(),
                        name: item.name,
                        value: index
                    }
                })
            )
        })

        await call[option]()
    } catch(e) {
        console.log('\nexit')
    }
})()
