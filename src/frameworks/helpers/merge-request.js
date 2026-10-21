const exec = require('child_process').exec
const axios = require('axios')
const minimist = require('minimist')
const config = require('../../config/config').config

const args = minimist(process.argv.slice(2))
const targetBranch = args.target
const assignment = args.assign
const reviewers = args.review
const projectName = args.project
const commitMessage = args.commit
const taskName = args.taskname
const comment =
  args.comment ||
  `Skuy tolong di cek ${config.bot.WA_MENTION_TEXT}, Terima Kasih`
const allowedTypes = ['feat', 'fix', 'refactor', 'docs', 'chore', 'test']

function exitWithError(message) {
  console.error(`❌ ${message}`)
  console.log(`
Usage:\nnpm run mr -- --target=<branch target MR> --assign=<username> --review=<username> --commit="<commit messages>" --project="<Project Name SDERP>" --taskname="<Task Name SD ERP>"\n
Example:\nnpm run mr -- --target=main --assign=SR --review=SR --commit="feat: add login, add sso, add quiz" --project="Sisfo Bahasa Uji Komputer" --taskname="Modul Pengelolaan Pertanyaan Kuis & Ujian - BE Sisfo Bahasa Pengelolaan Uji Komputer"`)
  process.exit(1)
}

function exitWithErrorCommit(message) {
  console.error(`❌ ${message}`)
  console.info(`✅ Format commit yang di izinkan [${allowedTypes}]`)
  process.exit(1)
}

function exitWithErrorConfig(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

// VALIDASI REQUIRED
if (!targetBranch) {
  exitWithError('target wajib diisi')
}
if (!assignment) {
  exitWithError('assign wajib diisi')
}
if (!reviewers) {
  exitWithError('reviewers wajib diisi')
}
if (!projectName) {
  exitWithError('project wajib diisi')
}
if (!commitMessage) {
  exitWithError('commit wajib diisi')
}
if (!taskName) {
  exitWithError('task name wajib diisi')
}

// VALIDASI BRANCH
const allowedBranches = ['main', 'develop']
if (!allowedBranches.includes(targetBranch)) {
  exitWithError(
    `target branch harus salah satu dari: ${allowedBranches.join(', ')}`
  )
}

// VALIDASI COMMIT FORMAT
let foundTypes = []

foundTypes = [...commitMessage.matchAll(/\b(\w+):/g)].map((match) => match[1])

if (foundTypes.length === 0) {
  exitWithError(
    `type tidak boleh kosong, ex: | ${[allowedTypes.toString().replaceAll(',', ': |')]}`
  )
}

const invalidTypes = foundTypes.filter((type) => !allowedTypes.includes(type))

if (invalidTypes.length > 0) {
  exitWithErrorCommit(`Commit type: "${invalidTypes.join(', ')}" Tidak Valid`)
}

function checkerConfigNotification(gitlab, bot) {
  gitlab?.GITLAB_TOKEN
    ? gitlab?.GITLAB_TOKEN
    : exitWithErrorConfig(
        'gitlab token tidak boleh kosong, cek kembali di file .env'
      )

  gitlab?.GITLAB_PROJECT_ID
    ? gitlab?.GITLAB_PROJECT_ID
    : exitWithErrorConfig(
        'gitlab project tidak boleh kosong, cek kembali di file .env'
      )

  gitlab?.GITLAB_URL
    ? gitlab?.GITLAB_URL
    : exitWithErrorConfig(
        'gitlab url tidak boleh kosong, cek kembali di file .env'
      )

  bot?.WA_BOT_URL
    ? bot?.WA_BOT_URL
    : exitWithErrorConfig('wa url tidak boleh kosong, cek kembali di file .env')

  bot?.WA_GROUP_NAME
    ? bot?.WA_GROUP_NAME
    : exitWithErrorConfig(
        'wa group name tidak boleh kosong, cek kembali di file .env'
      )

  bot?.WA_MENTION_ID
    ? bot?.WA_MENTION_ID
    : exitWithErrorConfig(
        'wa mention tidak boleh kosong, cek kembali di file .env'
      )

  bot?.WA_MENTION_TEXT
    ? bot?.WA_MENTION_TEXT
    : exitWithErrorConfig(
        'wa mention text tidak boleh kosong, cek kembali di file .env'
      )
}

function run(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr })
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

;(async () => {
  try {
    checkerConfigNotification(config?.gitlab, config?.bot)

    // branch aktif
    const branchResult = await run('git rev-parse --abbrev-ref HEAD')

    const currentBranch = branchResult.stdout.trim()

    const commits = [
      ...commitMessage.matchAll(/(\w+):\s*([^:]+)(?=\s+\w+:|$)/g)
    ].map(([originalText, type, body]) => ({
      type,
      body: body.trim()
    }))

    // title hanya type
    const mrTitle = commits?.flatMap((commitType) =>
      commitType?.type?.toUpperCase()
    )

    // format description
    const mrDescription = commits
      .map(({ type, body }) => {
        const items = body
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)

        return `${type.toUpperCase()}:\n${items
          .map((item) => `- ${item}`)
          .join('\n')}`
      })
      .join('\n\n')

    console.log(mrDescription)

    async function getUserByUsername(username) {
      const res = await axios.get(`${config.gitlab.GITLAB_URL}/users`, {
        params: { username },
        headers: {
          'PRIVATE-TOKEN': config.gitlab.GITLAB_TOKEN
        }
      })

      if (!res.data || res.data.length === 0) {
        throw new Error(`Username "${username}" tidak ditemukan di GitLab`)
      }

      return res.data[0]
    }

    const assigneeUsers = await getUserByUsername(assignment)
    const reviewUsers = await getUserByUsername(reviewers)

    const mrResponse = await axios.post(
      `${config.gitlab.GITLAB_URL}/projects/${config.gitlab.GITLAB_PROJECT_ID}/merge_requests`,
      {
        source_branch: currentBranch,
        target_branch: targetBranch,
        title: `[${projectName.toUpperCase()}][${mrTitle}] - [${taskName}]`,
        description: mrDescription,
        assignee_ids: [assigneeUsers.id],
        reviewer_ids: [reviewUsers.id]
      },
      {
        headers: {
          'PRIVATE-TOKEN': config.gitlab.GITLAB_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    )

    const mrUrl = mrResponse.data.web_url

    console.log('MR URL:', mrUrl)

    const usermMention = config.bot.WA_MENTION_ID
    const userWa = [config.bot.WA_MENTION_TEXT]

    // notif WA
    await axios.post(`${config.bot.WA_BOT_URL}/send`, {
      groupName: config.bot.WA_GROUP_NAME,
      message: `🚀 Need CR (Code Review): \n
    📦 [${projectName.toUpperCase()}][${mrTitle}] - [${taskName}] \n
    🔗 ${mrUrl} \n
    🧙🏻 Assigner: ${assigneeUsers.name} \n
    🧙🏻 Reviewer: ${reviewUsers.name} \n
    🧰 From Sources: ${currentBranch?.toUpperCase()} \n
    👤 ${userWa} \n
    🗣️ ${comment}`,
      mentionsUsers: [usermMention]
    })
    console.log('Notif WA berhasil dikirim ke grup')
  } catch (err) {
    console.error('ERROR')
    if (err.stdout) {
      console.log(err.stdout)
    }
    if (err.stderr) {
      console.log(err.stderr)
    }

    console.error(err.error || err.message || err.response?.data)
    process.exit(1)
  }
})()
