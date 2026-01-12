<script lang="ts">
  import UserAvatar from '$lib/components/shared-components/user-avatar.svelte';
  import { handleAddUsersToAlbum } from '$lib/services/album.service';
  import { searchUsers, type AlbumResponseDto, type UserResponseDto } from '@immich/sdk';
  import { Button, FormModal, Icon, Stack, Text } from '@immich/ui';
  import { mdiCheck } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import { SvelteMap } from 'svelte/reactivity';

  type Props = {
    album: AlbumResponseDto;
    onClose: () => void;
  };

  const { album, onClose }: Props = $props();

  let users: UserResponseDto[] = $state([]);
  const excludedUserIds = $derived([album.ownerId, ...album.albumUsers.map(({ user: { id } }) => id)]);
  const filteredUsers = $derived(users.filter(({ id }) => !excludedUserIds.includes(id)));
  const selectedUsers = new SvelteMap<string, UserResponseDto>();

  const handleToggle = (user: UserResponseDto) => {
    if (selectedUsers.has(user.id)) {
      selectedUsers.delete(user.id);
    } else {
      selectedUsers.set(user.id, user);
    }
  };

  const onSubmit = async () => {
    const success = await handleAddUsersToAlbum(album, [...selectedUsers.values()]);

    if (success) {
      onClose();
    }
  };

  onMount(async () => {
    users = await searchUsers();
  });
</script>

<FormModal
  title={$t('users')}
  submitText={$t('add')}
  submitColor="primary"
  {onSubmit}
  disabled={selectedUsers.size === 0}
  onClose={() => onClose()}
>
  <Stack>
    {#each filteredUsers as user (user.id)}
      <div class="flex place-items-center transition-all hover:bg-light rounded-xl">
        <Button onclick={() => handleToggle(user)} fullWidth color="secondary">
          <UserAvatar {user} size="md" />
          <div class="text-start grow">
            <Text>{user.name}</Text>
            <Text size="small">{user.email}</Text>
          </div>
          {#if selectedUsers.has(user.id)}
            <Icon icon={mdiCheck} size="20" />
          {/if}
        </Button>
      </div>
    {:else}
      <Text>{$t('album_share_no_users')}</Text>
    {/each}
  </Stack>
</FormModal>
