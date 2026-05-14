# Bitbucket SSH
```
cd ~/.ssh
```

## create ssh key
```
ssh-keygen -t ed25519 -C "email_id" -f ~/.ssh/bitbucket
eval "$(ssh-agent -s)"
chmod 600 ~/.ssh/bitbucket
ssh-add ~/.ssh/bitbucket
ssh-add -l
```

## Fix permission
```
chmod 700 ~/.ssh
chmod 600 ~/.ssh/bitbucket
chmod 644 ~/.ssh/bitbucket.pub
chmod 600 ~/.ssh/config
```

## Test connection
```
ssh -vT git@bitbucket.org
```

## Add Config
```
nano ~/.ssh/config
Host bitbucket.org
    HostName bitbucket.org
    IdentityFile ~/.ssh/bitbucket
    IdentitiesOnly yes
```

## Copy SSH
```
cat ~/.ssh/bitbucket.pub
```
--- 