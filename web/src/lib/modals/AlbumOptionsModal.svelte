<script lang="ts">
  import AlbumSharedLink from '$lib/components/album-page/album-shared-link.svelte';
  import HeaderActionButton from '$lib/components/HeaderActionButton.svelte';
  import OnEvents from '$lib/components/OnEvents.svelte';
  import SettingSwitch from '$lib/components/shared-components/settings/setting-switch.svelte';
  import UserAvatar from '$lib/components/shared-components/user-avatar.svelte';
  import type { RenderedOption } from '$lib/elements/Dropdown.svelte';
  import { getAlbumActions, handleRemoveUserFromAlbum, handleUpdateUserAlbumRole } from '$lib/services/album.service';
  import { user } from '$lib/stores/user.store';
  import { handleError } from '$lib/utils/handle-error';
  import {
    AlbumUserRole,
    AssetOrder,
    getAlbumInfo,
    getAllSharedLinks,
    updateAlbumInfo,
    type AlbumResponseDto,
    type SharedLinkResponseDto,
    type UserResponseDto,
  } from '@immich/sdk';
  import { Field, Heading, HStack, Modal, ModalBody, Select, Stack, Text, toastManager } from '@immich/ui';
  import { mdiArrowDownThin, mdiArrowUpThin } from '@mdi/js';
  import { findKey } from 'lodash-es';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import SettingDropdown from '../components/shared-components/settings/setting-dropdown.svelte';

  type Props = {
    album: AlbumResponseDto;
    onClose: (result?: { action: 'changeOrder'; order: AssetOrder } | { action: 'refreshAlbum' }) => void;
  };

  let { album, onClose }: Props = $props();

  const options: Record<AssetOrder, RenderedOption> = {
    [AssetOrder.Asc]: { icon: mdiArrowUpThin, title: $t('oldest_first') },
    [AssetOrder.Desc]: { icon: mdiArrowDownThin, title: $t('newest_first') },
  };

  const roleOptions: Array<{ label: string; value: AlbumUserRole | 'none'; icon?: string }> = [
    { label: $t('role_editor'), value: AlbumUserRole.Editor },
    { label: $t('role_viewer'), value: AlbumUserRole.Viewer },
    { label: $t('remove_user'), value: 'none' },
  ];

  const selectedOption = $derived(album.order ? options[album.order] : options[AssetOrder.Desc]);

  const handleToggleOrder = async (returnedOption: RenderedOption): Promise<void> => {
    if (selectedOption === returnedOption) {
      return;
    }
    const order = findKey(options, (option) => option === returnedOption) as AssetOrder;

    try {
      await updateAlbumInfo({
        id: album.id,
        updateAlbumDto: {
          order,
        },
      });
      onClose({ action: 'changeOrder', order });
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_album'));
    }
  };

  const handleToggleActivity = async () => {
    try {
      album = await updateAlbumInfo({
        id: album.id,
        updateAlbumDto: {
          isActivityEnabled: !album.isActivityEnabled,
        },
      });

      toastManager.success($t('activity_changed', { values: { enabled: album.isActivityEnabled } }));
    } catch (error) {
      handleError(error, $t('errors.cant_change_activity', { values: { enabled: album.isActivityEnabled } }));
    }
  };

  const handleRoleSelect = async (user: UserResponseDto, role: AlbumUserRole | 'none') => {
    if (role === 'none') {
      await handleRemoveUserFromAlbum(album, user);
      return;
    }

    await handleUpdateUserAlbumRole({ albumId: album.id, userId: user.id, role });
  };

  const refreshAlbum = async () => {
    album = await getAlbumInfo({ id: album.id, withoutAssets: true });
  };

  const onAlbumUserDelete = async ({ userId }: { userId: string }) => {
    album.albumUsers = album.albumUsers.filter(({ user: { id } }) => id !== userId);
    await refreshAlbum();
  };

  const onSharedLinkCreate = (sharedLink: SharedLinkResponseDto) => {
    sharedLinks.push(sharedLink);
  };

  const onSharedLinkDelete = (sharedLink: SharedLinkResponseDto) => {
    sharedLinks = sharedLinks.filter(({ id }) => sharedLink.id !== id);
  };

  const { AddUsers, CreateSharedLink } = $derived(getAlbumActions($t, album));

  let sharedLinks: SharedLinkResponseDto[] = $state([]);

  onMount(async () => {
    sharedLinks = await getAllSharedLinks({ albumId: album.id });
  });
</script>

<OnEvents {onAlbumUserDelete} onAlbumShare={refreshAlbum} {onSharedLinkCreate} {onSharedLinkDelete} />

<Modal title={$t('options')} onClose={() => onClose({ action: 'refreshAlbum' })} size="small">
  <ModalBody>
    <Stack>
      <div class="py-2">
        <Heading size="tiny">{$t('settings')}</Heading>
        <div class="grid p-2 gap-y-2">
          {#if album.order}
            <SettingDropdown
              title={$t('display_order')}
              options={Object.values(options)}
              {selectedOption}
              onToggle={handleToggleOrder}
            />
          {/if}
          <SettingSwitch
            title={$t('comments_and_likes')}
            subtitle={$t('let_others_respond')}
            checked={album.isActivityEnabled}
            onToggle={handleToggleActivity}
          />
        </div>
      </div>
      <div class="py-2">
        <HStack fullWidth class="justify-between">
          <Heading size="tiny">{$t('people')}</Heading>
          <HeaderActionButton action={AddUsers} />
        </HStack>
        <div class="p-2">
          <div class="flex items-center gap-2 py-2 mt-2">
            <div>
              <UserAvatar user={$user} size="md" />
            </div>
            <div class="w-full">{$user.name}</div>
            <Field disabled class="w-32 shrink-0">
              <Select data={[{ label: $t('owner'), value: 'owner' }]} value={{ label: $t('owner'), value: 'owner' }} />
            </Field>
          </div>

          {#each album.albumUsers as { user, role } (user.id)}
            <div class="flex items-center justify-between gap-4 py-2">
              <div class="flex flex-row items-center gap-2">
                <div>
                  <UserAvatar {user} size="md" />
                </div>
                <Text>{user.name}</Text>
              </div>
              <Field class="w-32">
                <Select
                  data={roleOptions}
                  value={roleOptions.find(({ value }) => value === role)}
                  onChange={({ value }) => handleRoleSelect(user, value as AlbumUserRole | 'none')}
                />
              </Field>
            </div>
          {/each}
        </div>
      </div>
      <Stack gap={6}>
        <HStack class="justify-between">
          <Heading size="tiny">{$t('shared_links')}</Heading>
          <HeaderActionButton action={CreateSharedLink} />
        </HStack>

        <Stack gap={4}>
          {#each sharedLinks as sharedLink (sharedLink.id)}
            <AlbumSharedLink {album} {sharedLink} />
          {/each}
        </Stack>
      </Stack>
    </Stack>
  </ModalBody>
</Modal>
